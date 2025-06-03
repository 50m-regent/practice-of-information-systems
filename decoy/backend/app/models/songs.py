from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class Genre(Base):
    __tablename__ = "genres"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    songs = relationship("Song", back_populates="genre")


class Song(Base):
    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    artist = Column(String, index=True)
    genre_id = Column(Integer, ForeignKey("genres.id"))
    difficulty = Column(Integer, index=True)
    spotify_id = Column(String, unique=True, index=True)
    thumbnail_url = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    genre = relationship("Genre", back_populates="songs")
    sheet_music = relationship("SheetMusic", back_populates="song", uselist=False)


class SheetMusic(Base):
    __tablename__ = "sheet_music"

    id = Column(Integer, primary_key=True, index=True)
    song_id = Column(Integer, ForeignKey("songs.id"))
    music_data = Column(JSON)
    key_signature = Column(String)
    time_signature = Column(String)
    tempo = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    song = relationship("Song", back_populates="sheet_music")
