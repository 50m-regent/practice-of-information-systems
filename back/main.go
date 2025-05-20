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

	search(r)

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

func search(r *gin.Engine) {
	r.POST("/search", func(ctx *gin.Context) {
		var query SearchQuery
		if err := ctx.BindJSON(&query); err != nil {
			return
		}
		DbConnection, _ := sql.Open("sqlite3", "./musicdata.sql")
		defer DbConnection.Close()

		var result []DisplayMusic

		switch query.SearchCategory {
		case DiffSearch:
			cmd := `select M.*
			from Music M
			join Sheets S on M.id = S.music_id
			where S.difficulty = ` + strconv.Itoa(query.DiffSearch)
			rows, _ := DbConnection.Query(cmd)
			defer rows.Close()

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
		case KeywordSearch:
			cmd := ``
			_, err := DbConnection.Exec(cmd)
			if err != nil {
				log.Fatal(err)
			}
		case GenreSearch:
			cmd := ``
			_, err := DbConnection.Exec(cmd)
			if err != nil {
				log.Fatal(err)
			}
		}
		ctx.JSON(http.StatusOK, gin.H{
			// return result
		})
	})
}

type Difficulty int

type Proficiency float64

type Sheet string

type Genre int

const (
	Pops Genre = iota
	Rock
	etc //TODO
)

type Music struct {
	Sheets    []Sheet `json:"sheets"`
	Title     string  `json:"title"`
	MusicID   int     `json:"music_id"`
	Artist    string  `json:"Artist"`
	Genre     Genre   `json:"Genre"`
	Thumbnail string  `json:"thumbnail"`
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
