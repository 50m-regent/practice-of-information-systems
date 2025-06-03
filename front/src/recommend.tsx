import { LinkButton } from "./components/link";
import { Navbar } from './components/Navbar';
import { useState, useEffect} from "react";
import axios from "axios";
import { MusicItemIcon } from "./components/musicItemIcon";
import  "./css/recommend.css"
import { IoIosArrowBack } from 'react-icons/io';
import { useAuth } from './contexts/AuthContext';

type DysplayMusic ={
  musicID : number;
  title : string;
  artist : string;
  thumbnail : string;//画像のURL? 画像そのもの？
}

export const Recommend = () => {
    const title: string = "推薦画面";
    const [recommendMusic, setRecommendMusic] = useState<DysplayMusic[]>([]);
    const { spotifyAccessToken, isSpotifyAuthenticated } = useAuth(); // Contextから取得

    useEffect(() => {
      const fetchRecommendations = async () => {
        if (isSpotifyAuthenticated() && spotifyAccessToken) {
          try {
            console.log("Recommend.tsx: Fetching recommendations with Spotify token:", spotifyAccessToken);
            // const recoData = await axios.get(`http://localhost:8080/recommendations/spotify?accesstoken=${spotifyAccessToken}`);
            // setRecommendMusic(recoData.data);

            // APIが準備できるまではダミーデータを使用
            // const dummySpotifyRecoData = {
            //   data: [
            //     { musicID: 60, title: "Spotify Reco 1 (from context)", artist: "Artist S1", thumbnail: "https://via.placeholder.com/100x100?text=SReco1" },
            //     { musicID: 70, title: "Spotify Reco 2 (from context)", artist: "Artist S2", thumbnail: "https://via.placeholder.com/100x100?text=SReco2" },
            //   ]
            // };
            // setRecommendMusic(dummySpotifyRecoData.data);

          } catch (error) {
            console.error("Error fetching recommendations from Spotify:", error);
            // Spotifyからの取得に失敗した場合、習熟度ベースの推薦などにフォールバック
            fetchProficiencyRecommendations();
          }
        } else {
          console.log("Recommend.tsx: Spotify not authenticated or token not available. Fetching proficiency recommendations.");
          fetchProficiencyRecommendations();
        }
      };

      const fetchProficiencyRecommendations = async () => {
        try {
          const recoData = await axios.get("http://localhost:8080/recommendations/proficiency");
          // const recoData = await axios.get("http://localhost:8080/recommendations/spotify?accesstoken=${spotifyAccessToken}"); //Spotifyからおすすめ取るのはこっち
          // setRecommendMusic(recoData.data);
          // ダミーデータを使用
          // const proficiencyRecoData = {
          //   data: [
          //     { musicID: 5, title: "Proficiency Reco 1", artist: "Artist P1", thumbnail: "https://via.placeholder.com/100x100?text=PReco1" },
          //     { musicID: 8, title: "Proficiency Reco 2", artist: "Artist P2", thumbnail: "https://via.placeholder.com/100x100?text=PReco2" },
          //     { musicID: 9, title: "Proficiency Reco 3", artist: "Artist P3", thumbnail: "https://via.placeholder.com/100x100?text=PReco3" },
          //   ]
          // };
          setRecommendMusic(recoData.data || []);
        } catch (error) {
          console.error("Error fetching proficiency recommendations:", error);
          setRecommendMusic([]); // エラー時は空にする
        }
      };

      fetchRecommendations();
    }, [spotifyAccessToken, isSpotifyAuthenticated]); // spotifyAccessTokenとisSpotifyAuthenticatedを依存配列に追加
    return (
      <div className="Recommend">
        {/* ヘッダー */}
        <div className="header">
          <div className="header-left-content" style={{ color: "black"}}>
            <LinkButton
              link="/home"
              icon={
                <IoIosArrowBack />
              }
            />
            <span>おすすめの楽曲</span>
          </div>
        </div>

        {/* メイン */}
        <div className="main">
          <div className="music-grid-container">
            {
                recommendMusic.length > 0 ? (
                  recommendMusic.map((music) => (
                    <MusicItemIcon
                      key={music.musicID}
                      musicID={music.musicID}
                      title={music.title}
                      artist={music.artist}
                      thumbnail={music.thumbnail}
                    />
                  ))
                ) : (
                  <p style={{ paddingLeft: '10px', color: 'gray' }}>おすすめの楽曲はありません。</p>
                )
            }
          </div>
        </div>

        <div className="footer">
          <Navbar />
        </div>
      </div>
    );
}
