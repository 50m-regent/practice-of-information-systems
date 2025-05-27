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
	tokenJSON := `{"access_token":"BQCPPfGuBhjJktnT3wiCXrI1qU7z3XbzP0Kr2FwM6GywEchlvGePVN6F1CIYfTuEW3p56wYx4w7GoznnAo7s5ot_fxypYgFMcvYhNG-tFFTdzsgeETo-DeBEe3GSJweTdH2intIARnRlD-8s-z1KpFy0gcUT-qDJRlzVkYe08_xr08hUXVgoxHe6ZDfnDVoFjtd-pOXNQr1gHF_Ys9td_jJ9XZBhUBTUDCgwy1wE_yk4CPfUehBTZSghyzNfxhixU5GxUWEs-_fljdYa9zfCxg","token_type":"Bearer","expires_in":3600,"refresh_token":"AQBjq_ww621v3lqzmUysFO6MMm8e_m3IaERJgIHHv_8DlBdnfhQmIuK-pMW509tEyIzJhGnYnD1Xq_9KcFzX-EGe8jzvaZsyCOhyKDSrzodZbVoiXr-nYg-yYVZRjdrlYmg","scope":"playlist-read-private playlist-read-collaborative user-library-read user-follow-read user-read-recently-played user-top-read"}`

	/*
	* How to obtain a Spotify test access token:
	*
	* 1. Open your browser and navigate to the following URL:
	*    https://accounts.spotify.com/authorize?client_id=826a4a6ab717454aa24268036207a028&response_type=code&redirect_uri=http://127.0.0.1:5173/callback.html&scope=user-top-read%20user-read-recently-played%20user-library-read%20playlist-read-private%20playlist-read-collaborative%20user-follow-read
	*
	* 2. Log in to your Spotify account
	*
	* 3. After login, you will be redirected to example.org with a code parameter in the URL
	*    Extract the code from the URL (it will be after "code=" in the URL)
	*
	* 4. Use the following curl command to exchange the code for an access token:
	*    Replace <YOUR_AUTHORIZATION_CODE> with the code from step 3
	*
	*    curl -X POST https://accounts.spotify.com/api/token \
	*      -H "Authorization: Basic ODI2YTRhNmFiNzE3NDU0YWEyNDI2ODAzNjIwN2EwMjg6YjA0ZjdiNjNlNDZiNGE5ZWFjN2Q3YzQ4YWY4MjBlZTU=" \
	*      -H "Content-Type: application/x-www-form-urlencoded" \
	*      -d "grant_type=authorization_code&code=<YOUR_AUTHORIZATION_CODE>&redirect_uri=https://example.org/callback"
	*
	* 5. The response will contain your access token and refresh token in JSON format
	 */

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
