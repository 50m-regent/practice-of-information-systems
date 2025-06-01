import { LinkButton } from "./components/link";
import { Navbar } from './components/Navbar';
import { useState, useEffect} from "react";
import axios from "axios";
import { MusicItemIcon } from "./components/musicItemIcon";
import "./css/favorite.css";
import { IoIosArrowBack } from 'react-icons/io';

type DysplayMusic ={
  musicID : number;
  title : string;
  artist : string;
  thumbnail : string;//画像のURL? 画像そのもの？
}

export const Favorite = () => {
    const title: string = "ホーム画面";
      const [favoriteMusic, setFavoriteMusic] = useState<DysplayMusic[]>([]);

      useEffect(() => {
          (
              async () => {
                const favoData = {data:[
                // const favoData = await axios.get("http://localhost:8080/favorite");
              {
                musicID: 1,
                title: "Favorite Song 1",
                artist: "Artist A",
                thumbnail: "https://via.placeholder.com/100x100?text=Favo1",
              },
              {
                musicID: 2,
                title: "Favorite Song 2",
                artist: "Artist B",
                thumbnail: "https://via.placeholder.com/100x100?text=Favo2",
              },
              {
                musicID: 3,
                title: "Favorite Song 3",
                artist: "Artist C",
                thumbnail: "https://via.placeholder.com/100x100?text=Favo3",
              },
              {
                musicID: 4,
                title: "Favorite Song 4",
                artist: "Artist D",
                thumbnail: "https://via.placeholder.com/100x100?text=Favo4",
              },

            ]}
            setFavoriteMusic(favoData.data);
            }
        )()
        },[])

    return (
      <div className="Favorite">
        {/* ヘッダー */}
        <div className="header">
          <div className="header-left-content" style={{ color: "black"}}>
            <LinkButton
              link="/home"
              icon={
                <IoIosArrowBack />
              }
            />
            <span>お気に入りの楽曲</span>
          </div>
        </div>

        {/* メイン */}
        <div className="main">
          <div className="music-grid-container">
            {
                favoriteMusic.map((music) => (
                    <MusicItemIcon
                    key={music.musicID}
                    musicID={music.musicID}
                    title={music.title}
                    artist={music.artist}
                    thumbnail={music.thumbnail}
                    />
                ))
            }
          </div>
        </div>

        {/* フッター */}
        <div className="footer">
          <Navbar />
        </div>
      </div>
    );
}
