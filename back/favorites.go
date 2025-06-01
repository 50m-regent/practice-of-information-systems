package main

import (
	"database/sql"
	"fmt"
	"log"
)

// Add a music item to the user's favorites.
// It appends the music to the end of the current favorites list.
func AddFavorite(db *sql.DB, musicID int) error {
	var maxOrderKey sql.NullInt64
	err := db.QueryRow("SELECT MAX(order_key) FROM Favorites").Scan(&maxOrderKey)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to query max order_key: %w", err)
	}

	newOrderKey := 1
	if maxOrderKey.Valid {
		newOrderKey = int(maxOrderKey.Int64) + 1
	}

	_, err = db.Exec("INSERT INTO Favorites (music_id, order_key) VALUES (?, ?)", musicID, newOrderKey)
	if err != nil {
		return fmt.Errorf("failed to insert favorite: %w", err)
	}
	log.Printf("Added music_id %d to favorites with order_key %d", musicID, newOrderKey)
	return nil
}

// Retrieve the user's favorite music items, ordered by their preference.
func GetFavorites(db *sql.DB) ([]DisplayMusic, error) {
	rows, err := db.Query(`
		SELECT m.id, m.title, m.artist, m.thumbnail 
		FROM Music m
		JOIN Favorites f ON m.id = f.music_id
		ORDER BY f.order_key ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query favorites: %w", err)
	}
	defer rows.Close()

	var favorites []DisplayMusic
	for rows.Next() {
		var dm DisplayMusic
		if err := rows.Scan(&dm.MusicID, &dm.Title, &dm.Artist, &dm.Thumbnail); err != nil {
			return nil, fmt.Errorf("failed to scan favorite row: %w", err)
		}
		favorites = append(favorites, dm)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating favorite rows: %w", err)
	}
	log.Printf("Retrieved %d favorites", len(favorites))
	return favorites, nil
}

// Overwrite the user's current favorite list with the provided ordered list of music IDs.
func SetFavorites(db *sql.DB, musicIDs []int) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	_, err = tx.Exec("DELETE FROM Favorites")
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete existing favorites: %w", err)
	}

	stmt, err := tx.Prepare("INSERT INTO Favorites (music_id, order_key) VALUES (?, ?)")
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to prepare insert statement for favorites: %w", err)
	}
	defer stmt.Close()

	for i, musicID := range musicIDs {
		_, err := stmt.Exec(musicID, i+1) // order_key is 1-based
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to insert favorite (music_id: %d, order_key: %d): %w", musicID, i+1, err)
		}
	}

	log.Printf("Set %d favorites successfully", len(musicIDs))
	return tx.Commit()
}
