package main

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
)

func main() {

	// init db connection
	db, err := sql.Open("sqlite3", "./musicdata.sql")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// setup db schema
	if err := setupDBSchema(db); err != nil {
		log.Fatal(err)
	}

	// setup gin router
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"}, // for dev
		AllowMethods: []string{
			"POST",
			"GET",
			"OPTIONS",
		},
		AllowHeaders: []string{
			"Access-Control-Allow-Credentials",
			"Access-Control-Allow-Headers",
			"Content-Type",
			"Content-Length",
			"Accept-Encoding",
			"Authorization",
		},
	}))

	//hello(r)
	search_api(r, db)
	select_api(r, db)
	proficiency_api(r, db)
	r.Run(":8080")
}

func hello(r *gin.Engine) {
	fmt.Println("Hello World!")
	r.GET("/hello", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"message": "Hello, world!",
		})
	})
}

func setupDBSchema(db *sql.DB) error {
	cmd := `create table if not exists Music(
	id integer primary key autoincrement,
	title text not null,
	artist text,
	base_difficulty integer,
	genre text,
	thumbnail text
	)`

	if _, err := db.Exec(cmd); err != nil {
		return err
	}

	cmd = `create table if not exists Sheets(
	id integer primary key autoincrement,
	music_id integer,
	difficulty integer not null,
	sheet text not null,
	foreign key (music_id) references Music(id)
	)`

	if _, err := db.Exec(cmd); err != nil {
		return err
	}

	// UserProficiency table
	cmd = `CREATE TABLE IF NOT EXISTS UserProficiency (
		singleton_key INTEGER PRIMARY KEY DEFAULT 1 CHECK (singleton_key = 1),
		proficiency REAL NOT NULL DEFAULT 0.0
	)`
	if _, err := db.Exec(cmd); err != nil {
		return fmt.Errorf("failed to create UserProficiency table: %w", err)
	}
	// Initialize proficiency if it doesn't exist
	cmd = `INSERT OR IGNORE INTO UserProficiency (singleton_key, proficiency) VALUES (1, 0.0)`
	if _, err := db.Exec(cmd); err != nil {
		return fmt.Errorf("failed to initialize UserProficiency: %w", err)
	}

	// Favorites table
	cmd = `CREATE TABLE IF NOT EXISTS Favorites (
		music_id INTEGER PRIMARY KEY,
		order_key TEXT, 
		FOREIGN KEY (music_id) REFERENCES Music(id)
	)`
	if _, err := db.Exec(cmd); err != nil {
		return fmt.Errorf("failed to create Favorites table: %w", err)
	}

	// UserMusicDifficultySettings table
	cmd = `CREATE TABLE IF NOT EXISTS UserMusicDifficultySettings (
		music_id INTEGER NOT NULL,
		measure INTEGER NOT NULL,
		difficulty INTEGER NOT NULL,
		PRIMARY KEY (music_id, measure),
		FOREIGN KEY (music_id) REFERENCES Music(id)
	)`
	if _, err := db.Exec(cmd); err != nil {
		return err
	}

	return nil
}

func search_api(r *gin.Engine, db *sql.DB) {
	r.POST("/search", func(ctx *gin.Context) {
		var query SearchQuery
		if err := ctx.BindJSON(&query); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var result []DisplayMusic
		var rows *sql.Rows
		var err error
		baseQuery := "SELECT id, title, artist, thumbnail FROM Music " // Corrected 'artis' to 'artist'
		var args []interface{}

		switch query.SearchCategory {
		case DiffSearch:
			baseQuery += "WHERE base_difficulty = ?" // Added space before WHERE
			args = append(args, query.DiffSearch)
		case KeywordSearch:
			searchText := "%" + query.TextSearch + "%"
			baseQuery += "WHERE title LIKE ? OR artist LIKE ?" // Added space before WHERE
			args = append(args, searchText, searchText)
		case GenreSearch:
			baseQuery += "WHERE genre = ?" // Added space before WHERE
			args = append(args, query.GenreSearch.String())
		default:
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid search category"})
			return
		}

		log.Printf("Executing search query: %s with args: %v", baseQuery, args) // For debugging

		rows, err = db.Query(baseQuery, args...)
		if err != nil {
			log.Printf("Error executing search query: %v", err) // Changed log.Fatal to log.Printf
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error executing query"})
			return
		}
		defer rows.Close()

		for rows.Next() {
			var dm DisplayMusic
			if scanErr := rows.Scan(&dm.MusicID, &dm.Title, &dm.Artist, &dm.Thumbnail); scanErr != nil {
				log.Printf("Database scan error in search: %v", scanErr)
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Database scan error"})
				return
			}
			result = append(result, dm)
		}
		ctx.IndentedJSON(http.StatusOK, result)
	})
}

func select_api(r *gin.Engine, db *sql.DB) {
	r.POST("/select", func(ctx *gin.Context) {
		var req SelectRequest
		if err := ctx.BindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
			return
		}

		musicData := Music{MusicID: req.MusicID}
		var genreStr string

		// Fetch music metadata
		err := db.QueryRow("SELECT title, artist, genre, thumbnail FROM Music WHERE id = ?", req.MusicID).Scan(
			&musicData.Title, &musicData.Artist, &genreStr, &musicData.Thumbnail,
		)
		if err != nil {
			if err == sql.ErrNoRows {
				ctx.JSON(http.StatusNotFound, gin.H{"error": "Music not found"})
				return
			}
			log.Printf("Database error querying music metadata (id: %d): %v", req.MusicID, err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve music metadata"})
			return
		}

		parsedGenre, genreErr := ParseGenre(genreStr)
		if genreErr != nil {
			log.Printf("Error parsing genre '%s' for music_id %d: %v", genreStr, req.MusicID, genreErr)
			// Decide if this is a fatal error or if you want to proceed with a default/unknown genre
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse genre information"})
			return
		}
		musicData.Genre = parsedGenre

		// Fetch sheets for the music
		rows, err := db.Query("SELECT sheet, difficulty FROM Sheets WHERE music_id = ?", req.MusicID)
		if err != nil {
			log.Printf("Database error querying sheets (music_id: %d): %v", req.MusicID, err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve sheets"})
			return
		}
		defer rows.Close()

		var sheets []Sheet
		for rows.Next() {
			var s Sheet
			if scanErr := rows.Scan(&s.Sheet, &s.Difficulty); scanErr != nil {
				log.Printf("Database scan error for sheet (music_id: %d): %v", req.MusicID, scanErr)
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan sheet data"})
				return
			}
			sheets = append(sheets, s)
		}
		if err = rows.Err(); err != nil {
			log.Printf("Error iterating sheet rows (music_id: %d): %v", req.MusicID, err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing sheets data"})
			return
		}
		musicData.Sheets = sheets
		ctx.IndentedJSON(http.StatusOK, musicData)
	})
}

// ProficiencyAPIRequest defines the structure for updating proficiency
type UpdateProficiencyRequest struct {
	Proficiency float64 `json:"proficiency"`
}

func proficiency_api(r *gin.Engine, db *sql.DB) {
	// Get current proficiency
	r.GET("/proficiency", func(ctx *gin.Context) {
		var proficiency float64
		err := db.QueryRow("SELECT proficiency FROM UserProficiency WHERE singleton_key = 1").Scan(&proficiency)
		if err != nil {
			if err == sql.ErrNoRows {
				// This case should ideally be handled by initialization,
				// but as a fallback, return 0.0 or an appropriate error.
				log.Printf("UserProficiency record not found, returning default 0.0")
				ctx.JSON(http.StatusOK, 0.0) // Or http.StatusInternalServerError
				return
			}
			log.Printf("Error fetching proficiency: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch proficiency"})
			return
		}
		ctx.JSON(http.StatusOK, proficiency)
	})

	// Update proficiency
	r.PUT("/proficiency", func(ctx *gin.Context) {
		var req UpdateProficiencyRequest
		if err := ctx.BindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
			return
		}

		_, err := db.Exec("UPDATE UserProficiency SET proficiency = ? WHERE singleton_key = 1", req.Proficiency)
		if err != nil {
			log.Printf("Error updating proficiency: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update proficiency"})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"message": "Proficiency updated successfully", "proficiency": req.Proficiency})
	})
}

type Difficulty int

type Proficiency float64

type Genre int

const (
	Pops Genre = iota
	Rock
	etc //TODO
)

func (g Genre) String() string {
	switch g {
	case Pops:
		return "Pops"
	case Rock:
		return "Rock"
	case etc:
		return "etc"
	}
	return "Unknown" // Default for unhandled cases
}

func ParseGenre(s string) (Genre, error) {
	switch s {
	case "Pops":
		return Pops, nil
	case "Rock":
		return Rock, nil
	case "etc":
		return etc, nil
	}
	return -1, errors.New("unknown genre: " + s) // Return an invalid Genre value and an error
}

type Sheet struct {
	Sheet      string `json:"sheet"`
	Difficulty int    `json:"difficulty"`
}

type Music struct {
	Sheets    []Sheet `json:"sheets"`
	Title     string  `json:"title"`
	MusicID   int     `json:"music_id"`
	Artist    string  `json:"artist"`
	Genre     Genre   `json:"genre"`
	Thumbnail string  `json:"thumbnail"`
}

func NewMusic(sheets []Sheet, title string, id int, artist string, genre Genre, thumbnail string) *Music {
	return &Music{Sheets: sheets, Title: title, MusicID: id, Artist: artist, Genre: genre, Thumbnail: thumbnail}
}

type MusicSegment struct {
	Measure int `json:"measure"`
}

type AudioClip struct {
	Clip       []float64    `json:"clip"`
	NowPlaying MusicSegment `json:"now_playing"`
}

type DisplayMusic struct {
	Title     string `json:"title"`
	MusicID   int    `json:"music_id"`
	Artist    string `json:"artist"`
	Thumbnail string `json:"thumbnail"`
}

func NewDisplayMusic(title string, id int, artist string, thumbnail string) *DisplayMusic {
	return &DisplayMusic{Title: title, MusicID: id, Artist: artist, Thumbnail: thumbnail}
}

type SearchCategory int

const (
	DiffSearch SearchCategory = iota
	KeywordSearch
	GenreSearch
)

type SearchQuery struct {
	DiffSearch     int            `json:"diff_search"`
	TextSearch     string         `json:"text_search"`
	GenreSearch    Genre          `json:"genre_search"`
	SearchCategory SearchCategory `json:"search_category"`
}

type SelectRequest struct {
	MusicID int `json:"music_id"`
}
