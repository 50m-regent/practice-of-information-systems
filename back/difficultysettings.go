package main

import (
	"database/sql"
	"fmt"
	"log"
)

// DifficultySetting represents a difficulty setting for a specific measure of a music piece.
type DifficultySetting struct {
	Measure    int `json:"measure"`
	Difficulty int `json:"difficulty"`
}

// SetUserMusicDifficultySettings saves or updates the difficulty settings for a given music ID.
// It first deletes any existing settings for the music ID, then inserts the new ones.
func SetUserMusicDifficultySettings(db *sql.DB, musicID int, settings []DifficultySetting) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction for difficulty settings: %w", err)
	}

	// Delete existing settings for this music_id
	_, err = tx.Exec("DELETE FROM UserMusicDifficultySettings WHERE music_id = ?", musicID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete existing difficulty settings for music_id %d: %w", musicID, err)
	}

	// Prepare statement for inserting new settings
	stmt, err := tx.Prepare("INSERT INTO UserMusicDifficultySettings (music_id, measure, difficulty) VALUES (?, ?, ?)")
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to prepare insert statement for difficulty settings: %w", err)
	}
	defer stmt.Close()

	for _, setting := range settings {
		_, err := stmt.Exec(musicID, setting.Measure, setting.Difficulty)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to insert difficulty setting (music_id: %d, measure: %d, difficulty: %d): %w", musicID, setting.Measure, setting.Difficulty, err)
		}
	}

	log.Printf("Successfully set %d difficulty settings for music_id %d", len(settings), musicID)
	return tx.Commit()
}

// GetUserMusicDifficultySettings retrieves the difficulty settings for a given music ID.
func GetUserMusicDifficultySettings(db *sql.DB, musicID int) ([]DifficultySetting, error) {
	rows, err := db.Query("SELECT measure, difficulty FROM UserMusicDifficultySettings WHERE music_id = ? ORDER BY measure ASC", musicID)
	if err != nil {
		return nil, fmt.Errorf("failed to query difficulty settings for music_id %d: %w", musicID, err)
	}
	defer rows.Close()

	var settings []DifficultySetting
	for rows.Next() {
		var s DifficultySetting
		if err := rows.Scan(&s.Measure, &s.Difficulty); err != nil {
			return nil, fmt.Errorf("failed to scan difficulty setting row for music_id %d: %w", musicID, err)
		}
		settings = append(settings, s)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating difficulty setting rows for music_id %d: %w", musicID, err)
	}

	if len(settings) == 0 {
		// Return empty slice if no settings found, not an error
		return []DifficultySetting{}, nil
	}

	log.Printf("Retrieved %d difficulty settings for music_id %d", len(settings), musicID)
	return settings, nil
}
