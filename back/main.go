package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
)

func main() {

	// init db connection
	db, err := sql.Open("sqlite3", "./musicdata.sql?_foreign_keys=on")
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

	spotify_recommend_api(r)
	proficiency_recommend_api(r, db)

	favorites_api(r, db)
	history_api(r, db)
	difficulty_settings_api(r, db)
	calc_proficiency_api(r, db) // db を渡すように変更

	r.Run(":8080")

}

// SpotifyRecommendRequest defines the structure for the recommendation request body.
type SpotifyRecommendRequest struct {
	AccessToken string `json:"access_token"`
	Limit       int    `json:"limit"` // Optional: Max number of recently played tracks to fetch from Spotify (default: 10)
	Count       int    `json:"count"` // Optional: Number of tracks to recommend (default: 2)
}

/*
 * Handles requests to the /recommendations/spotify endpoint.
 *
 * This API endpoint provides song recommendations based on the user's recently played tracks
 * on Spotify. It requires a valid Spotify access token.
 *
 * Method: POST
 * URL: /recommendations/spotify
 *
 * Request Body (JSON):
 * {
 *   "access_token": "YOUR_SPOTIFY_ACCESS_TOKEN", // Required: User's Spotify access token
 *   "limit": 10,                                  // Optional: How many recent tracks to consider (default: 10)
 *   "count": 2                                    // Optional: How many recommendations to return (default: 2)
 * }
 *
 * Successful Response (200 OK, JSON):
 * An array of RecommendedTrack objects:
 * [
 *   {
 *     "id": "spotify_track_id_1",
 *     "title": "Song Title 1",
 *     "artist": "Artist Name 1",
 *     "album": "Album Name 1",
 *     "image_url": "url_to_album_cover_1.jpg"
 *   },
 *   {
 *     "id": "spotify_track_id_2",
 *     "title": "Song Title 2",
 *     "artist": "Artist Name 2",
 *     "album": "Album Name 2",
 *     "image_url": "url_to_album_cover_2.jpg"
 *   }
 * ]
 *
 * Error Responses:
 * - 400 Bad Request (JSON): If the request body is invalid.
 *   { "error": "Invalid request body" }
 * - 500 Internal Server Error (JSON): If there's an error fetching or processing recommendations.
 *   { "error": "Description of the error" }
 */
func spotify_recommend_api(r *gin.Engine) {
	r.POST("/recommendations/spotify", func(ctx *gin.Context) {
		var request SpotifyRecommendRequest
		if err := ctx.BindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		recommendations, err := GetRecommendationsFromRecentlyPlayed(request.AccessToken, request.Limit, request.Count)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		ctx.JSON(http.StatusOK, recommendations)
	})
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
		order_key INTEGER NOT NULL,
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

	// SearchHistory table
	cmd = `CREATE TABLE IF NOT EXISTS SearchHistory (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		music_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		artist TEXT,
		thumbnail TEXT,
		searched_at DATETIME NOT NULL
	)`
	if _, err := db.Exec(cmd); err != nil {
		return fmt.Errorf("failed to create SearchHistory table: %w", err)
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
		// Add search results to history
		if err := AddSearchEntriesToHistory(db, result); err != nil {
			// Log error but don't fail the search request itself
			log.Printf("Warning: Failed to add entries to search history: %v", err)
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

func proficiency_recommend_api(r *gin.Engine, db *sql.DB) {
	r.GET("/recommendations/proficiency", func(ctx *gin.Context) {
		// Default values
		defaultCount := 5
		defaultTolerance := 1

		countStr := ctx.DefaultQuery("count", fmt.Sprintf("%d", defaultCount))
		count, err := strconv.Atoi(countStr)
		if err != nil || count <= 0 {
			count = defaultCount
			log.Printf("Invalid 'count' query parameter, using default %d", count)
		}

		toleranceStr := ctx.DefaultQuery("tolerance", fmt.Sprintf("%d", defaultTolerance))
		tolerance, err := strconv.Atoi(toleranceStr)
		if err != nil || tolerance < 0 { // Tolerance can be 0
			tolerance = defaultTolerance
			log.Printf("Invalid 'tolerance' query parameter, using default %d", tolerance)
		}

		// 1. Get User Proficiency
		var userProficiencyFloat float64
		err = db.QueryRow("SELECT proficiency FROM UserProficiency WHERE singleton_key = 1").Scan(&userProficiencyFloat)
		if err != nil {
			if err == sql.ErrNoRows {
				// Should be initialized, but handle defensively
				log.Printf("UserProficiency record not found, cannot make proficiency-based recommendations.")
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "User proficiency not found"})
				return
			}
			log.Printf("Error fetching user proficiency: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user proficiency"})
			return
		}

		// 2. Round proficiency
		roundedProficiency := int(math.Round(userProficiencyFloat))

		// 3. Calculate difficulty range
		minDifficulty := roundedProficiency - tolerance
		maxDifficulty := roundedProficiency + tolerance

		// 4. Query Music
		query := `
			SELECT id, title, artist, thumbnail
			FROM Music
			WHERE base_difficulty >= ? AND base_difficulty <= ?
			ORDER BY RANDOM()
			LIMIT ?`

		rows, err := db.Query(query, minDifficulty, maxDifficulty, count)
		if err != nil {
			log.Printf("Error querying proficiency-based recommendations: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query recommendations"})
			return
		}
		defer rows.Close()

		var recommendations []DisplayMusic
		for rows.Next() {
			var dm DisplayMusic
			if err := rows.Scan(&dm.MusicID, &dm.Title, &dm.Artist, &dm.Thumbnail); err != nil {
				log.Printf("Error scanning recommendation row: %v", err)
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process recommendation data"})
				return
			}
			recommendations = append(recommendations, dm)
		}
		ctx.JSON(http.StatusOK, recommendations)
	})
}

// CalculateProficiencyRequest defines the structure for the proficiency calculation request.
type CalculateProficiencyRequest struct {
	Audio          []float64   `json:"audio" binding:"required"`
	Difficulty     int         `json:"difficulty"` // 0も有効な値として送信
	CorrectPitches [][]float64 `json:"correct_pitches" binding:"required"`
}

// CalculateProficiencyResponse defines the structure for the proficiency calculation response.
type CalculateProficiencyResponse struct {
	Proficiency float64 `json:"proficiency"`
}

type Difficulty int

type Proficiency float64

type Genre int

const (
	Pops Genre = iota
	Rock
	Anime //TODO
)

func (g Genre) String() string {
	switch g {
	case Pops:
		return "Pops"
	case Rock:
		return "Rock"
	case Anime:
		return "Anime"
	}
	return "Unknown" // Default for unhandled cases
}

func ParseGenre(s string) (Genre, error) {
	switch s {
	case "Pops":
		return Pops, nil
	case "Rock":
		return Rock, nil
	case "Anime":
		return Anime, nil
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

type AddFavoriteRequest struct {
	MusicID int `json:"music_id"`
}

type SetFavoritesRequest struct {
	MusicIDs []int `json:"music_ids"`
}

func favorites_api(r *gin.Engine, db *sql.DB) {
	// Add a favorite
	r.POST("/favorites", func(ctx *gin.Context) {
		var req AddFavoriteRequest
		if err := ctx.BindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
			return
		}
		if req.MusicID <= 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid music_id"})
			return
		}

		if err := AddFavorite(db, req.MusicID); err != nil {
			log.Printf("Error adding favorite: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add favorite"})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"message": "Favorite added successfully"})
	})

	// Get all favorites
	r.GET("/favorites", func(ctx *gin.Context) {
		favorites, err := GetFavorites(db)
		if err != nil {
			log.Printf("Error getting favorites: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get favorites"})
			return
		}
		ctx.JSON(http.StatusOK, favorites)
	})

	// Set/Reorder favorites
	r.PUT("/favorites", func(ctx *gin.Context) {
		var req SetFavoritesRequest
		if err := ctx.BindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
			return
		}

		if err := SetFavorites(db, req.MusicIDs); err != nil {
			log.Printf("Error setting favorites: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set favorites"})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"message": "Favorites set successfully"})
	})
}

func history_api(r *gin.Engine, db *sql.DB) {
	// Get recent search history
	r.GET("/history/searches", func(ctx *gin.Context) {
		limitStr := ctx.DefaultQuery("limit", strconv.Itoa(defaultHistoryLimit)) // Use constant from history.go
		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit <= 0 {
			limit = defaultHistoryLimit // Use constant from history.go
		}

		history, err := GetSearchHistory(db, limit)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get search history: " + err.Error()})
			return
		}
		ctx.JSON(http.StatusOK, history)
	})
}

func difficulty_settings_api(r *gin.Engine, db *sql.DB) {
	// Set/Update difficulty settings for a music
	r.PUT("/music/:music_id/difficulty-settings", func(ctx *gin.Context) {
		musicIDStr := ctx.Param("music_id")
		musicID, err := strconv.Atoi(musicIDStr)
		if err != nil || musicID <= 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid music_id in path"})
			return
		}

		var settings []DifficultySetting
		if err := ctx.BindJSON(&settings); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
			return
		}

		if err := SetUserMusicDifficultySettings(db, musicID, settings); err != nil {
			log.Printf("Error setting difficulty settings for music_id %d: %v", musicID, err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set difficulty settings"})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Difficulty settings for music_id %d updated successfully", musicID)})
	})

	// Get difficulty settings for a music
	r.GET("/music/:music_id/difficulty-settings", func(ctx *gin.Context) {
		musicIDStr := ctx.Param("music_id")
		musicID, err := strconv.Atoi(musicIDStr)
		if err != nil || musicID <= 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid music_id in path"})
			return
		}

		settings, err := GetUserMusicDifficultySettings(db, musicID)
		if err != nil {
			log.Printf("Error getting difficulty settings for music_id %d: %v", musicID, err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get difficulty settings"})
			return
		}
		ctx.JSON(http.StatusOK, settings)
	})
}

func calc_proficiency_api(r *gin.Engine, db *sql.DB) {
	r.POST("/calc_proficiency", func(ctx *gin.Context) {
		const fixedSamplingRate = 48000.0

		// Declare variables
		var currentProficiency float64
		var req CalculateProficiencyRequest // Request body structure
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
			return
		}

		// CorrectPitches の各要素が2つのfloatであることを検証 (オプションだが推奨)
		for i, pitchPair := range req.CorrectPitches {
			if len(pitchPair) != 2 {
				ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid format for 'correct_pitches' at index %d. Each item must be an array of two floats.", i)})
				return
			}
		}

		// 1. Get current proficiency from DB (after validating request body)
		err := db.QueryRow("SELECT proficiency FROM UserProficiency WHERE singleton_key = 1").Scan(&currentProficiency) // Assign to existing err
		if err != nil {
			if err == sql.ErrNoRows {
				log.Printf("UserProficiency record not found, cannot calculate proficiency.")
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "User proficiency not found, cannot calculate proficiency"})
				return
			}
			log.Printf("Error fetching current proficiency: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch current proficiency"})
			return
		}

		// 2. Prepare data for Python script
		pythonInputData := map[string]interface{}{
			"audio":               req.Audio,
			"difficulty":          req.Difficulty,
			"current_proficiency": currentProficiency,
			"correct_pitches":     req.CorrectPitches,
			"sampling_rate":       fixedSamplingRate,
		}
		reqBytes, err := json.Marshal(pythonInputData)
		if err != nil {
			log.Printf("Error marshalling request for Python script: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare data for proficiency calculation"})
			return
		}

		// 3. Call external proficiency calculation API
		const proficiencyApiUrl = "http://localhost:8008/calculate_proficiency"
		resp, err := http.Post(proficiencyApiUrl, "application/json", bytes.NewReader(reqBytes))
		if err != nil {
			log.Printf("Error calling proficiency calculation API: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call proficiency calculation service"})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			var errBody bytes.Buffer
			_, _ = errBody.ReadFrom(resp.Body)
			log.Printf("Proficiency calculation API returned error: %s, status code: %d, body: %s", err, resp.StatusCode, errBody.String())
			// Try to parse error from API response
			var apiError struct {
				Error string `json:"error"`
			}
			if json.NewDecoder(bytes.NewReader(errBody.Bytes())).Decode(&apiError) == nil && apiError.Error != "" {
				ctx.JSON(resp.StatusCode, gin.H{"error": "Proficiency calculation error: " + apiError.Error})
			} else {
				ctx.JSON(resp.StatusCode, gin.H{"error": "Proficiency calculation failed with status: " + resp.Status})
			}
			return
		}

		var apiResp CalculateProficiencyResponse
		if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
			log.Printf("Error unmarshalling response from proficiency API: %v", err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse proficiency calculation result"})
			return
		}

		/*
			"os/exec"

			// Pythonスクリプトのパスを適切に指定
			cmd := exec.Command("uv", "run", "python", "calculate_proficiency_runner.py")
			cmd.Dir = "./../tech" // 'tech' ディレクトリでコマンドを実行
			cmd.Stdin = bytes.NewReader(reqBytes)

			var stdout, stderr bytes.Buffer
			cmd.Stdout = &stdout
			cmd.Stderr = &stderr

			err = cmd.Run()
			if err != nil {
				log.Printf("Error running Python script: %v. Stderr: %s", err, stderr.String())
				// Python側でエラーがJSON形式でstderrに出力されることを期待
				var pyErr struct {
					Error string `json:"error"`
				}
				if json.Unmarshal(stderr.Bytes(), &pyErr) == nil && pyErr.Error != "" {
					ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Proficiency calculation script error: " + pyErr.Error})
				} else {
					ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Proficiency calculation script failed: " + stderr.String()})
				}
				return
			}

			var resp CalculateProficiencyResponse
			if err := json.Unmarshal(stdout.Bytes(), &resp); err != nil {
				log.Printf("Error unmarshalling response from Python script: %v. Stdout: %s", err, stdout.String())
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse proficiency calculation result"})
				return
			}

		*/

		ctx.JSON(http.StatusOK, apiResp)
	})
}
