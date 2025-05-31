import { LinkButton } from "./components/link";
import { Navbar } from './components/Navbar';
import { useState, useEffect} from "react";
import axios from "axios";
import { MusicItemIcon } from "./components/musicItemIcon";
import  "./css/recommend.css"
import { IoIosArrowBack } from 'react-icons/io';

type DysplayMusic ={
  musicID : number;
  title : string;
  artist : string;
  thumbnail : string;//画像のURL? 画像そのもの？
}

export const Recommend = () => {
    const title: string = "推薦画面";
    const [recommendMusic, setRecommendMusic] = useState<DysplayMusic[]>([]);

    useEffect(() => {
        (
            async () => {
                // const recoData = await axios.get("http://localhost:8080/recommend?");
                const recoData= {data:[
              {
                musicID: 5,
                title: "Favorite Song 5",
                artist: "Artist E",
                thumbnail: "https://via.placeholder.com/100x100?text=Favo5",
              },
              {
                musicID: 6,
                title: "Recommended Song 1",
                artist: "Artist X",
                thumbnail: "https://via.placeholder.com/100x100?text=Reco1",
              },
              {
                musicID: 7,
                title: "Recommended Song 2",
                artist: "Artist Y",
                thumbnail: "https://via.placeholder.com/100x100?text=Reco2",
              },
              {
                musicID: 8,
                title: "Recommended Song 3",
                artist: "Artist Z",
                thumbnail: "https://via.placeholder.com/100x100?text=Reco3",
              },
              {
                musicID: 9,
                title: "Recommended Song 4",
                artist: "Artist W",
                thumbnail: "https://via.placeholder.com/100x100?text=Reco4",
              },
              {
                musicID: 10,
                title: "Recommended Song 5",
                artist: "Artist V",
                thumbnail: "https://via.placeholder.com/100x100?text=Reco5",
              },
            ]}
            setRecommendMusic(recoData.data);
            }
        )()
        },[])
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
                recommendMusic.map((music) => (
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

        <div className="footer">
          <Navbar />
        </div>
      </div>
    );
}
