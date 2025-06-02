import { LinkButton } from "./components/link";
import { Navbar } from './components/Navbar';
import { MusicItemList } from "./components/musicItemList";
import { useState, useEffect, useCallback} from "react";
import axios from "axios";
import debounce from "lodash/debounce";
import { DysplayMusic, Genre, SearchCategory, SearchQuery } from "./types/types";
import "./css/search.css";
import { MusicItemIcon } from "./components/musicItemIcon";

const GENRE_LINE_COLORS = [
  '#FF6347', // Tomato
  '#FF4500', // OrangeRed
  '#4682B4', // SteelBlue
  '#1E90FF', // DodgerBlue
  '#3CB371', // MediumSeaGreen
  '#20B2AA', // LightSeaGreen
  '#FFD700', // Gold
  '#DAA520', // Goldenrod
  '#8A2BE2', // BlueViolet
  '#FF1493', // DeepPink

];

export const Search = () => {//検索画面と結果表示画面をもつ
    const title: string = "検索画面";
    const [searchQuery, setSearchQuery] = useState<SearchQuery>("");
    const [searchCategory, setSearchCategory] = useState<SearchCategory>("");
    const [musicList, setMusicList] = useState<DysplayMusic[]>([]);
    const [genreList, setGenreList] = useState<Genre[]>([]);
    const [recentSearch, setRecentSearch] = useState<DysplayMusic[]>([]);

    const fetchMusic = useCallback(//検索クエリを元に音楽リストを取得する関数
        // debounceを使用して、入力が止まってから500ms後に実行
        // useCallbackを使用して、関数をメモ化?
        debounce(async (query: SearchQuery, category: SearchCategory) => {
            // console.log(musicList);
            if (!query) {
                setMusicList([]);
                return;
            }
            try {
                // const response = await axios.get(`http://localhost:8080/search?searchCategory=${category}&searchQuery=${query}`);
                // setMusicList(response.data);
                // ここではダミーデータを使用
                // 変更するたびに要素が追加されるダミー
                const test = "test"+category+":"+query;
                setMusicList(prevList => {
                    const updated = [{ musicID: prevList.length, title: test, artist: test, thumbnail: test }, ...prevList];
                    console.log("検索結果:", updated);
                    return updated;
                });
            } catch (error) {
                console.error("検索に失敗:", error);
            }
        }, 500),
        [] // debounceは一度だけ定義
    );
    useEffect(() => {//ジャンルのリスト初回レンダリング時のみ実行+
      //最近の検索を取得する関数，を追加しなければならない
        (
            async () => {
                // const genreData = await axios.get("http://localhost:8080/genre");
                // setGenreList(genreData.data);
                // ここではダミーデータを使用
                const genreData = {data:[Genre.JPOP, Genre.KPOP, Genre.CLASSIC, Genre.ROCK, Genre.HIPHOP, Genre.JAZZ, Genre.BLUES, Genre.REGGAE, Genre.FUNK, Genre.DISCO, Genre.METAL, Genre.PUNK, Genre.FOLK, Genre.COUNTRY, Genre.ELECTRONIC]}
                setGenreList(genreData.data);
            }
        )()
    },[]);

    useEffect(() => {// 検索クエリが変更されたときにfetchMusicを呼び出す, debounceのため第２引数にfetchmusicも入れてるらしい
        fetchMusic(searchQuery,searchCategory);
    }, [searchQuery, fetchMusic]);

    useEffect(() => {// 最近の検索を取得
        (async () => {
            console.log('test')
            // const history = await axios.get("http://localhosot:8080/history/searches")
            // setRecentSearch(history.data);
            // ここではダミーデータを使用
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
        setRecentSearch(recoData.data);
        })();
      }, [])

    return (
        <>
        <div className="Search">
            <div className="header">
            <input type="search"
                placeholder="曲名・アーティスト名で検索"
                // value={searchQuery}
                onChange={(event) => {
                    if (event.target.value === "") {
                        setSearchQuery("");
                    }else{
                        setSearchCategory(SearchCategory.Title);
                        setSearchQuery(event.target.value);
                    }
                }} //アーティスト・楽曲名検索クエリ
                />
            </div>

            <div className="main">
            {
                (musicList.length > 0) ? (//検索クエリが存在している場合の画面
                    <div className="search_result">
                        <div className="music-grid-container">
                        {musicList.map((music, index) => (
                            // 音楽表示用コンポーネントの作成
                            <MusicItemIcon
                                key={music.musicID}
                                musicID={music.musicID}
                                title={music.title}
                                artist={music.artist}
                                thumbnail={music.thumbnail}
                            />
                        ))}
                        </div>
                    </div>
                 ) : (//検索クエリが存在しない場合の画面
                    <>
                    <div className="recentSearch">
                        <b style={{paddingLeft: '10px'}}>最近の検索</b>
                        {(recentSearch.length > 0) ? (
                            <div className="horizontal-scroll-container">
                                {recentSearch.map((music) => (
                                    <MusicItemIcon
                                        key={music.musicID}
                                        musicID={music.musicID}
                                        title={music.title}
                                        artist={music.artist}
                                        thumbnail={music.thumbnail}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p style={{ paddingLeft: '10px', color: 'gray' }}>最近の検索はありません</p>
                        )}
                    </div>
                    <div className="diffSearch">
                        <b style={{paddingLeft: '10px'}}>難易度から検索</b>
                        <div className="difficulty-button-container">
                            {[...Array(9)].map((_, i) => {
                                const level = i + 1;
                                return (
                                    <div key={level}>
                                        <button key={level} onClick={() => {setSearchCategory(SearchCategory.Difficulty); setSearchQuery(level)}}>
                                            {level}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="genreSearch">
                        <b style={{paddingLeft: '10px'}}>ジャンルから検索</b>
                        <div className="genre-grid-container">
                            {genreList.map((genre, index) => {
                                const lineColor = GENRE_LINE_COLORS[index % GENRE_LINE_COLORS.length];
                                return (
                                    <div key={index}>
                                    <button key={index} style={{'--line-color': lineColor }} onClick={() => {setSearchCategory(SearchCategory.Genre); setSearchQuery(genre)}}>
                                        {genre}
                                    </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </>
                )
            }
            </div>
        </div>
        <Navbar />
        </>
    );
}
