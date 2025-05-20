package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
)

var DbConnection *sql.DB

func main() {

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
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

	//database()

	//hello(r)

	search_api(r)

	select_api(r)

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

func database() {
	DbConnection, _ := sql.Open("sqlite3", "./musicdata.sql")
	defer DbConnection.Close()

	cmd := `create table if not exists Music(
	id int,
	title string,
	artis string,
	base_difficulty int,
	genre string,
	thumbnail blob,
	primary key (id)
	)`
	_, err := DbConnection.Exec(cmd)
	if err != nil {
		log.Fatal(err)
	}

	cmd = `create table if not exists Sheets(
	id int,
	music_id int,
	difficulty int,
	sheet string,
	primary key (id),
	foreign key (music_id)
	)`
	_, err = DbConnection.Exec(cmd)
	if err != nil {
		log.Fatal(err)
	}
}

func search_api(r *gin.Engine) {
	r.POST("/search", func(ctx *gin.Context) {
		var query SearchQuery
		if err := ctx.BindJSON(&query); err != nil {
			return
		}
		DbConnection, _ := sql.Open("sqlite3", "./musicdata.sql")
		defer DbConnection.Close()

		var result []DisplayMusic
		var rows *sql.Rows

		switch query.SearchCategory {
		case DiffSearch:
			cmd := `select M.*
			from Music M
			where M.base_difficulty = ` + strconv.Itoa(query.DiffSearch)
			rows, _ = DbConnection.Query(cmd)
			defer rows.Close()
		case KeywordSearch:
			cmd := `select M.*
			from Music M
			where M.title like '%` + query.TextSearch + `%' or M.artist like '%` + query.TextSearch + `%';`
			rows, _ = DbConnection.Query(cmd)
			defer rows.Close()
		case GenreSearch:
			cmd := `select *
			from Music
			where genre = '` + query.GenreSearch.String() + `';`
			rows, _ = DbConnection.Query(cmd)
			defer rows.Close()
		}

		var data []Music
		for rows.Next() {
			var m Music
			err := rows.Scan(&m.Title, &m.MusicID, &m.Artist, &m.Thumbnail) //アドレスを引数に渡すstructにデータを入れてくれる
			if err != nil {
				log.Fatal(err)
			}
			data = append(data, m)
		}
		for _, m := range data {
			fmt.Println(m.Title, m.MusicID, m.Artist, m.Thumbnail) // test
			result = append(result, *NewDisplayMusic(m.Title, m.MusicID, m.Artist, m.Thumbnail))
		}
		ctx.IndentedJSON(http.StatusOK, result)
	})
}

func select_api(r *gin.Engine) {
	r.POST("/select", func(ctx *gin.Context) {
		var music_id int
		if err := ctx.BindJSON(&music_id); err != nil {
			return
		}
		DbConnection, _ := sql.Open("sqlite3", "./musicdata.sql")
		defer DbConnection.Close()

		var rows *sql.Rows

		cmd := `select *
		from Music
		where music_id = ` + strconv.Itoa(music_id)
		rows, _ = DbConnection.Query(cmd)
		defer rows.Close()
		var music_info Music
		err := rows.Scan(&music_info.Title, &music_info.MusicID, &music_info.Artist, &music_info.Genre, &music_info.Thumbnail)
		if err != nil {
			log.Fatal(err)
		}

		cmd = `select sheet, difficulty
		from Sheets
		where music_id = ` + strconv.Itoa(music_id)
		rows, _ = DbConnection.Query(cmd)
		defer rows.Close()

		var data []Sheet
		for rows.Next() {
			var s Sheet
			err := rows.Scan(&s.Sheet, &s.Difficulty) //アドレスを引数に渡すstructにデータを入れてくれる
			if err != nil {
				log.Fatal(err)
			}
			data = append(data, s)
		}
		result := *NewMusic(data, music_info.Title, music_id, music_info.Artist, music_info.Genre, music_info.Thumbnail)
		ctx.IndentedJSON(http.StatusOK, result)
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
	}
	return ""
}

type Sheet struct {
	Sheet      string `json:"sheet"`
	Difficulty int    `json:"dfficulty"`
}

type Music struct {
	Sheets    []Sheet `json:"sheets"`
	Title     string  `json:"title"`
	MusicID   int     `json:"music_id"`
	Artist    string  `json:"Artist"`
	Genre     Genre   `json:"Genre"`
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
	NowPlaying MusicSegment `json:"nowplaying"`
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
