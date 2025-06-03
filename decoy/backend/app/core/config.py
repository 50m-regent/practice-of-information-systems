from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    SPOTIFY_CLIENT_ID: str = ""
    SPOTIFY_CLIENT_SECRET: str = ""
    SPOTIFY_REDIRECT_URI: str = "http://localhost:8000/api/callback"
    API_V1_STR: str = "/api/v1"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
