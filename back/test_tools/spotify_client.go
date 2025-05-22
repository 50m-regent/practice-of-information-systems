/*
 * Test client for Spotify recommendation API integration.
 *
 * This is a test tool that verifies:
 * 1. Direct connectivity to Spotify's API using a provided access token
 * 2. Functionality of our custom recommendation API endpoint
 *
 * The test makes two requests:
 * - One directly to Spotify's recently played API to verify token validity
 * - One to our local recommendation endpoint to test the complete workflow
 */

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// Data structures used for testing
type TokenData struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type RecommendedTrack struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	Album    string `json:"album"`
	ImageURL string `json:"image_url"`
}

func main() {
	// Sample access token for testing
	tokenJSON := `{"access_token":"BQAV9rCv8dI8TCW4XVeGXS3N3f6Q9TPE5chqgkLV2YChlsKE6xeMcwsK6hWp3CiOo0gNlfYRKeKtximVStOewYCLfKUCFsOwm6oEcj3UCTp9QoSK3iKZzNJWnW2ij-Xe87m2Dj9qQjpGMe58RI_JUOC-E2e5JdAGDXw__CNvWPXpdB4gIsg7k3zNxjqgc1obOnK5k_L8n1LzE3etsuHq5lirvRv9Puf5n4IQOH-1uKWP8U2dsMyrJInTtIIzXdTgugwir0srdXJ3LiPY53RN1zvjqQdkoEWkFf8","token_type":"Bearer","expires_in":3600,"refresh_token":"AQAqkCywTiJ9lmhcxbqLwz3nK8emGaHyyST83A3USjHE3wRxX5cdHZ67bX4VZPlOQCUtVkHcEiljujN23xWfI96ZI3cgNjPpGX6gcEBmbw96JEk2F6nuexOeStP9LO03amw","scope":"playlist-read-private playlist-read-collaborative user-library-read user-follow-read user-read-recently-played user-read-email user-top-read user-read-private"}`

	var token TokenData
	err := json.Unmarshal([]byte(tokenJSON), &token)
	if err != nil {
		fmt.Printf("Error parsing token: %v\n", err)
		return
	}

	// Test parameters
	limit := 10 // Number of recent tracks to fetch
	count := 2  // Number of recommendations to return

	// 1. Test direct Spotify API call
	fmt.Println("Testing direct Spotify API call...")
	testDirectSpotifyAPI(token.AccessToken, limit)

	// 2. Test our recommendation API
	fmt.Println("\nTesting our recommendation API...")
	testRecommendAPI(token.AccessToken, limit, count)
}

// Test direct call to Spotify API to verify access token and response format
func testDirectSpotifyAPI(accessToken string, limit int) {
	url := fmt.Sprintf("https://api.spotify.com/v1/me/player/recently-played?limit=%d", limit)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		return
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error sending request: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("API error: %s (Status code: %d)\n", string(body), resp.StatusCode)
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		return
	}

	fmt.Println("Successfully retrieved recently played tracks from Spotify.")
	// Print partial response to avoid excessive output
	if len(body) > 200 {
		fmt.Printf("Response preview: %s...\n", string(body[:200]))
	} else {
		fmt.Printf("Response: %s\n", string(body))
	}
}

// Test our custom recommendations API endpoint
func testRecommendAPI(accessToken string, limit int, count int) {
	url := "http://localhost:8080/recommend"
	reqBody := fmt.Sprintf(`{"access_token":"%s","limit":%d,"count":%d}`, accessToken, limit, count)

	req, err := http.NewRequest("POST", url, strings.NewReader(reqBody))
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error sending request: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		return
	}

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("API error: %s (Status code: %d)\n", string(body), resp.StatusCode)
		return
	}

	var recommendations []RecommendedTrack
	err = json.Unmarshal(body, &recommendations)
	if err != nil {
		fmt.Printf("Error parsing recommendations: %v\n", err)
		return
	}

	fmt.Printf("Successfully retrieved %d recommendations:\n", len(recommendations))
	for i, track := range recommendations {
		fmt.Printf("%d. Title: %s, Artist: %s, Album: %s\n", i+1, track.Title, track.Artist, track.Album)
	}
}
