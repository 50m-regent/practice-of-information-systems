from fastapi import APIRouter, HTTPException, Query

from ...services.spotify import SpotifyService

router = APIRouter()
spotify_service = SpotifyService()


@router.get("/auth")
async def spotify_auth():
    """Spotify認証URLを取得する"""
    auth_url = spotify_service.get_auth_url()
    if auth_url is None:
        raise HTTPException(status_code=500, detail="Failed to generate Spotify auth URL")
    return {"auth_url": auth_url}


@router.get("/callback")
async def spotify_callback(code: str = Query(...)):
    """Spotifyからのコールバックを処理する"""
    try:
        token_info = spotify_service.get_access_token(code)
        return token_info
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/search")
async def search_tracks(
    query: str = Query(..., description="検索クエリ"), access_token: str = Query(..., description="Spotifyアクセストークン")
):
    """楽曲を検索する"""
    try:
        results = spotify_service.search_track(query, access_token)
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tracks/{track_id}")
async def get_track(track_id: str, access_token: str = Query(..., description="Spotifyアクセストークン")):
    """特定の楽曲情報を取得する"""
    try:
        track = spotify_service.get_track(track_id, access_token)
        if track is None:
            raise HTTPException(status_code=404, detail="Track not found")
        return track
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
