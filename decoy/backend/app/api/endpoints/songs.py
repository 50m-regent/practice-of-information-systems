from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ...core.database import get_db
from ...models.songs import Song, Genre
from ...schemas.songs import Song as SongSchema
from ...schemas.songs import Genre as GenreSchema
from ...schemas.songs import SongSearch

router = APIRouter()


@router.get("/search", response_model=List[SongSchema])
async def search_songs(
    search_params: SongSearch = Depends(),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """
    楽曲を検索する
    - query: タイトルまたはアーティスト名での検索
    - genre_id: ジャンルでの絞り込み
    - min_difficulty: 最小難易度
    - max_difficulty: 最大難易度
    """
    query = db.query(Song)

    # テキスト検索
    if search_params.query:
        search_term = f"%{search_params.query}%"
        query = query.filter(or_(Song.title.ilike(search_term), Song.artist.ilike(search_term)))

    # ジャンルでの絞り込み
    if search_params.genre_id is not None:
        query = query.filter(Song.genre_id == search_params.genre_id)

    # 難易度での絞り込み
    if search_params.min_difficulty is not None:
        query = query.filter(Song.difficulty >= search_params.min_difficulty)
    if search_params.max_difficulty is not None:
        query = query.filter(Song.difficulty <= search_params.max_difficulty)

    # ページネーション
    songs = query.offset(skip).limit(limit).all()
    return songs


@router.get("/genres", response_model=List[GenreSchema])
async def get_genres(db: Session = Depends(get_db)):
    """ジャンル一覧を取得する"""
    return db.query(Genre).all()


@router.get("/difficulty/{level}", response_model=List[SongSchema])
async def get_songs_by_difficulty(
    level: int = Path(..., ge=1, le=9, description="難易度レベル"),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """指定した難易度の楽曲を取得する"""
    songs = db.query(Song).filter(Song.difficulty == level).offset(skip).limit(limit).all()
    return songs


@router.get("/{song_id}", response_model=SongSchema)
async def get_song(song_id: int = Path(..., description="楽曲ID"), db: Session = Depends(get_db)):
    """楽曲の詳細情報を取得する"""
    song = db.query(Song).filter(Song.id == song_id).first()
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    return song
