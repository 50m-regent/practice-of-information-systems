import base64

import requests

from ..core.config import get_settings

settings = get_settings()


class SpotifyService:
    def __init__(self):
        self.client_id = settings.SPOTIFY_CLIENT_ID
        self.client_secret = settings.SPOTIFY_CLIENT_SECRET
        self.redirect_uri = settings.SPOTIFY_REDIRECT_URI
        self.auth_url = "https://accounts.spotify.com/authorize"
        self.token_url = "https://accounts.spotify.com/api/token"
        self.api_base_url = "https://api.spotify.com/v1"

    def get_auth_url(self) -> str | None:
        """認証URLを生成する"""
        scope = "user-read-private user-read-email"
        params = {"client_id": self.client_id, "response_type": "code", "redirect_uri": self.redirect_uri, "scope": scope}
        auth_url = requests.Request("GET", self.auth_url, params=params).prepare().url
        return auth_url

    def get_access_token(self, code: str) -> dict:
        """認証コードからアクセストークンを取得する"""
        auth_header = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()

        headers = {"Authorization": f"Basic {auth_header}", "Content-Type": "application/x-www-form-urlencoded"}

        data = {"grant_type": "authorization_code", "code": code, "redirect_uri": self.redirect_uri}

        response = requests.post(self.token_url, headers=headers, data=data)
        return response.json()

    def search_track(self, query: str, access_token: str) -> dict:
        """楽曲を検索する"""
        headers = {"Authorization": f"Bearer {access_token}"}
        params = {"q": query, "type": "track", "market": "JP", "limit": 20}
        response = requests.get(f"{self.api_base_url}/search", headers=headers, params=params)
        return response.json()

    def get_track(self, track_id: str, access_token: str) -> dict | None:
        """特定の楽曲情報を取得する"""
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(f"{self.api_base_url}/tracks/{track_id}", headers=headers)
        if response.status_code == 200:
            return response.json()
        return None
