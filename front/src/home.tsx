import { LinkButton } from "./components/test/link";
import { Navbar } from './components/Navbar';
import { useState, useEffect} from "react";
import axios from "axios";
import { MusicItemIcon } from "./components/musicItemIcon";
type DysplayMusic ={
  musicID : number;
  title : string;
  artist : string;
  thumbnail : string;//画像のURL? 画像そのもの？
}
 const MAX_MUSIC_NUM = 5; //表示する音楽の最大数

export const Home = () => {
  const title: string = "ホーム画面";
  const [favoriteMusic, setFavoriteMusic] = useState<DysplayMusic[]>([]);
  const [recommendMusic, setRecommendMusic] = useState<DysplayMusic[]>([]);

  useEffect(() => {
    (
      async () => {
        const favoData = {data:[
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
        // const favoData = await axios.get("http://localhost:8080/favorite");
        // const recoData = await axios.get("http://localhost:8080/recommend?");
        setFavoriteMusic(favoData.data.slice(0,Math.min(MAX_MUSIC_NUM, favoData.data.length)));
        setRecommendMusic(recoData.data.slice(0,Math.min(MAX_MUSIC_NUM, recoData.data.length)));    
        }
    )()
    },[])
  return (
    <>
    <div className="Home">
      ヘッダー
    <LinkButton text="Spotify認証画面/Auth" link="/auth" />
      <h3>クイックアクセス</h3>
      内容不明
      <h3>お気に入り</h3>
        <LinkButton text="すべて見る" link="/favorite" />
        {
          favoriteMusic.map((music) => (
            <div key={music.musicID}>
              <MusicItemIcon
                musicID={music.musicID}
                title={music.title}
                artist={music.artist}
                thumbnail={music.thumbnail}
              />
            </div>
          ))
        }
        <h3>おすすめ</h3>
        <LinkButton text="すべて見る" link="/recommend" />
        {
          recommendMusic.map((music) => (
            <div key={music.musicID}>
              <MusicItemIcon
                musicID={music.musicID}
                title={music.title}
                artist={music.artist}
                thumbnail={music.thumbnail}
              />
            </div>
          ))
        }
    <Navbar />
    </div>
    </>
  );
}
