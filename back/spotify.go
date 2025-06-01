/*
 * Spotify API client for music recommendations.
 *
 * This file implements a workaround for track recommendations since Spotify's official
 * recommendation API is no longer publicly available. Instead, we fetch the user's
 * recently played tracks and randomly select from them to create a simple recommendation
 * system. The randomization provides variety while still being personalized to the user's
 * listening history.
 */

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"time"
)

// SpotifyRecentlyPlayedResponse represents the response from Spotify's recently played API
type SpotifyRecentlyPlayedResponse struct {
	Items []struct {
		Track struct {
			ID      string `json:"id"`
			Name    string `json:"name"`
			Artists []struct {
				Name string `json:"name"`
			} `json:"artists"`
			Album struct {
				Name   string `json:"name"`
				Images []struct {
					URL    string `json:"url"`
					Height int    `json:"height"`
					Width  int    `json:"width"`
				} `json:"images"`
			} `json:"album"`
		} `json:"track"`
	} `json:"items"`
}

// RecommendedTrack represents a track recommended to the user
type RecommendedTrack struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	Album    string `json:"album"`
	ImageURL string `json:"image_url"`
}

// GetRecommendationsFromRecentlyPlayed randomly selects tracks from user's recently played tracks
// Parameters:
// - accessToken: Spotify API access token
// - limit: maximum number of recently played tracks to fetch (defaults to 10)
// - count: number of tracks to recommend (defaults to 2)
func GetRecommendationsFromRecentlyPlayed(accessToken string, limit int, count int) ([]RecommendedTrack, error) {
	// Set default values
	if limit <= 0 {
		limit = 10
	}
	if count <= 0 {
		count = 2
	}

	// Ensure count doesn't exceed limit
	if count > limit {
		count = limit
	}

	// Get recently played tracks
	recentTracks, err := getRecentlyPlayedTracks(accessToken, limit)
	if err != nil {
		return nil, err
	}

	// Return all tracks if there aren't enough to select from
	if len(recentTracks.Items) <= count {
		return convertToRecommendedTracks(recentTracks), nil
	}

	// Randomly select count tracks
	rand.Seed(time.Now().UnixNano())
	selectedIndices := rand.Perm(len(recentTracks.Items))[:count]

	// Create result array
	result := make([]RecommendedTrack, count)
	for i, idx := range selectedIndices {
		track := recentTracks.Items[idx].Track
		artist := ""
		if len(track.Artists) > 0 {
			artist = track.Artists[0].Name
		}

		imageURL := ""
		if len(track.Album.Images) > 0 {
			imageURL = track.Album.Images[0].URL
		}

		result[i] = RecommendedTrack{
			ID:       track.ID,
			Title:    track.Name,
			Artist:   artist,
			Album:    track.Album.Name,
			ImageURL: imageURL,
		}
	}

	return result, nil
}

// Fetch recently played tracks from Spotify API
func getRecentlyPlayedTracks(accessToken string, limit int) (*SpotifyRecentlyPlayedResponse, error) {
	url := fmt.Sprintf("https://api.spotify.com/v1/me/player/recently-played?limit=%d", limit)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error sending request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("error response from Spotify API: %s, status code: %d", string(body), resp.StatusCode)
	}

	var result SpotifyRecentlyPlayedResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return &result, nil
}

// Convert Spotify API response to a list of RecommendedTrack objects
func convertToRecommendedTracks(recentTracks *SpotifyRecentlyPlayedResponse) []RecommendedTrack {
	result := make([]RecommendedTrack, len(recentTracks.Items))
	for i, item := range recentTracks.Items {
		track := item.Track
		artist := ""
		if len(track.Artists) > 0 {
			artist = track.Artists[0].Name
		}

		imageURL := ""
		if len(track.Album.Images) > 0 {
			imageURL = track.Album.Images[0].URL
		}

		result[i] = RecommendedTrack{
			ID:       track.ID,
			Title:    track.Name,
			Artist:   artist,
			Album:    track.Album.Name,
			ImageURL: imageURL,
		}
	}
	return result
}
