package main

import (
	"log"

	"github.com/gin-gonic/gin"
	// Placeholder for config import
	// Placeholder for db import
	// Placeholder for handler import
)

func main() {
	// TODO: Load configuration
	// config.Load()

	// TODO: Initialize database connection
	// dbInstance, err := db.NewSQLite("path/to/database.db") // Get path from config
	// if err != nil {
	// 	log.Fatalf("Failed to connect to database: %v", err)
	// }
	// defer db.Close(dbInstance)

	// TODO: Run database migrations
	// db.Migrate(dbInstance)

	// Initialize Gin engine
	r := gin.Default()

	// TODO: Setup middleware

	// TODO: Initialize repositories
	// TODO: Initialize services
	// TODO: Initialize handlers
	// TODO: Register routes
	// handler.RegisterRoutes(r, dbInstance) // Pass DB or repos/services

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	// TODO: Get server address from config
	serverAddr := ":8080"
	log.Printf("Server listening on %s", serverAddr)
	if err := r.Run(serverAddr); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
