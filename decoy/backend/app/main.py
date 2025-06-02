from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.endpoints import spotify, songs
from .core.config import get_settings
from .core.database import engine
from .models import songs as song_models

# データベースのテーブルを作成
song_models.Base.metadata.create_all(bind=engine)

settings = get_settings()

app = FastAPI(title="やさシート API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では適切に制限してください
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターの登録
app.include_router(spotify.router, prefix=f"{settings.API_V1_STR}/spotify", tags=["spotify"])
app.include_router(songs.router, prefix=f"{settings.API_V1_STR}/songs", tags=["songs"])
