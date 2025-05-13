import { LinkButton } from "./components/test/link";
import { Navbar } from './components/Navbar';
import { useState, useEffect} from "react";
import axios from "axios";
import { MusicItemList } from "./components/musicItemList";
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
        <>
        <div className="Recommend">
        <h3>ヘッダー</h3>
        <LinkButton text="Spotify認証/Auth" link="/auth" />
        <h3>お気に入り</h3>
        {
            recommendMusic.map((music) => (
            <div key={music.musicID}>
                <MusicItemList
                musicID={music.musicID}
                title={music.title}
                artist={music.artist}
                thumbnail={music.thumbnail}
                />
            </div>
            ))
        }
        </div>
        <Navbar />
        </>
    );
}