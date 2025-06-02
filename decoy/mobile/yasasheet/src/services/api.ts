import axios from 'axios';

interface SpotifyAuthResponse {
    auth_url: string;
}

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const spotifyApi = {
    getAuthUrl: async () => {
        try {
            const response = await axios.get<SpotifyAuthResponse>(`${API_BASE_URL}/spotify/auth`);
            return response.data.auth_url;
        } catch (error) {
            console.error('API Error:', error);
            throw new Error('Failed to get Spotify auth URL');
        }
    },

    authenticate: async (code: string) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/spotify/callback`, {
                params: { code },
            });
            return response.data;
        } catch (error) {
            throw new Error('Failed to authenticate with Spotify');
        }
    },

    searchTracks: async (query: string, accessToken: string) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/spotify/search`, {
                params: { query, access_token: accessToken },
            });
            return response.data;
        } catch (error) {
            throw new Error('Failed to search tracks');
        }
    },

    getTrack: async (trackId: string, accessToken: string) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/spotify/tracks/${trackId}`, {
                params: { access_token: accessToken },
            });
            return response.data;
        } catch (error) {
            throw new Error('Failed to get track');
        }
    },
};
