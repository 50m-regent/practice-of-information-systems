from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class GenreBase(BaseModel):
    name: str


class GenreCreate(GenreBase):
    pass


class Genre(GenreBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SheetMusicBase(BaseModel):
    key_signature: str
    time_signature: str
    tempo: int
    music_data: dict


class SheetMusicCreate(SheetMusicBase):
    song_id: int


class SheetMusic(SheetMusicBase):
    id: int
    song_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SongBase(BaseModel):
    title: str
    artist: str
    genre_id: int
    difficulty: int
    spotify_id: Optional[str] = None
    thumbnail_url: Optional[str] = None


class SongCreate(SongBase):
    pass


class Song(SongBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    genre: Genre
    sheet_music: Optional[SheetMusic] = None

    class Config:
        from_attributes = True


class SongSearch(BaseModel):
    query: Optional[str] = None
    genre_id: Optional[int] = None
    min_difficulty: Optional[int] = None
    max_difficulty: Optional[int] = None
