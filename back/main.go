package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

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
	genre string
	)`
	_, err := DbConnection.Exec(cmd)
	if err != nil {
		log.Fatal(err)
	}

	cmd = `create table if not exists Sheets(
	id int,
	music_id int,
	difficulty int,
	sheet string
	)`
	_, err = DbConnection.Exec(cmd)
	if err != nil {
		log.Fatal(err)
	}
}

func search(r *gin.Engine) {
	r.POST("/search", func(ctx *gin.Context) {
		var query SearchCategory
		if err := ctx.BindJSON(&query); err != nil {
			return
		}
		// todo search process here
		ctx.JSON(http.StatusOK, gin.H{
			//
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
	Sheets []Sheet `json:"sheets"`
	Title  string  `json:"title"`
	Artist string  `json:"Artist"`
	Genre  Genre   `json:"Genre"`
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
	Artist    string `json:"artist"`
	Thumbnail []int  `json:"thumbnail"`
}

type SearchCategory int

const (
	DiffSearch SearchCategory = iota
	TitleSearch
	ArtistSearch
	GenreSearch
)

type SearchQuery struct {
	DiffSearch     int            `json:"diff_search"`
	TextSearch     string         `json:"text_search"`
	GenreSearch    Genre          `json:"genre_search"`
	SearchCategory SearchCategory `json:"search_category"`
}
