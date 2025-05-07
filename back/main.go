package main

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	fmt.Println("Hello World!")
	r := gin.Default()
	r.GET("/hello", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"message": "Hello, world!",
		})
	})
	r.Run(":8080")
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
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	Tumbnail []int  `json:"tumbnail"`
}

type SearchCategory int

const (
	DiffSearch SearchCategory = iota
	TitleSearch
	ArtistSearch
	GenreSearch
)

type SearchQuery struct {
	DiffSearch  int    `json:"diffsearch"`
	TextSearch  string `json:"textsearch"`
	GenreSearch Genre  `json:"genresearch"`
}
