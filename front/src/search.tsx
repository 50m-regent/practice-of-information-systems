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

// Define the structure for the searchQuery object in the POST request payload
interface BackendSearchQueryPayload {
    diff_search: number;
    text_search: string;
    genre_search: string;
}

export const Search = () => {//検索画面と結果表示画面をもつ
    const title: string = "検索画面";
    // searchQueryとsearchCategoryを一つのオブジェクトで管理
    interface SearchParameters {
      queryValue: SearchQuery; // 実際の検索クエリ (テキスト、難易度レベル、ジャンル名)
      category: SearchCategory;    // 検索カテゴリ
    }
    const [searchParams, setSearchParams] = useState<SearchParameters | null>(null);
    const [musicList, setMusicList] = useState<DysplayMusic[]>([]);
    const [genreList, setGenreList] = useState<Genre[]>([]);
    const [recentSearch, setRecentSearch] = useState<DysplayMusic[]>([]);

    const fetchMusic = useCallback(//検索クエリを元に音楽リストを取得する関数
        // debounceを使用して、入力が止まってから500ms後に実行
        // useCallbackを使用して、関数をメモ化?
        debounce(async (params: SearchParameters | null) => {
            // console.log(musicList);
            if (!params || params.queryValue === "" || params.queryValue === null || params.queryValue === undefined) {
                setMusicList([]);
                return;
            }
            try {
                console.log("category", params.category);
                console.log("queryValue from params", params.queryValue);

                // Construct the new searchQuery payload
                const backendSearchQuery: BackendSearchQueryPayload = {
                    diff_search: 1,
                    text_search: "",
                    genre_search: "Pops"
                };

                switch (params.category) {
                    case SearchCategory.Title:
                        backendSearchQuery.text_search = String(params.queryValue);
                        break;
                    case SearchCategory.Difficulty:
                        backendSearchQuery.diff_search = 1; // Convert number to string
                        break;
                    case SearchCategory.Genre:
                        backendSearchQuery.genre_search = String(params.queryValue); // Genre is likely already a string
                        break;
                    default:
                        console.warn("Unknown search category:", params.category);
                        setMusicList([]);
                        return;
                }

                console.log("query", {
                        ...backendSearchQuery, // Spread the query fields
                        search_category: params.category // Add searchCategory at the top level
                    });
                // const response = await axios.post("http://localhost:8080/search",
                //     {
                //         ...backendSearchQuery, // Spread the query fields
                //         search_category: params.category // Add searchCategory at the top level
                //     }
                // );
                const response = await axios.post("http://localhost:8080/search",
                    {
                        text_search: backendSearchQuery.text_search // Spread the query fields
                    }
                );
                console.log("response",response)
                // if (response.data === null) {
                //     setMusicList([]);
                //     return;
                // }
                setMusicList(response.data || []);
            } catch (error) {
                console.error("検索に失敗:", error);
                setMusicList([]); // Clear list on error
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
        fetchMusic(searchParams);
    }, [searchParams, fetchMusic]);

    // useEffect(() => {// 最近の検索を取得
    //     (async () => {
    //         console.log('test')
    //         // const history = await axios.get("http://localhosot:8080/history/searches")
    //         // setRecentSearch(history.data);
    //         // ここではダミーデータを使用
    //         const recoData= {data:[
    //     {
    //         musicID: 5,
    //         title: "Favorite Song 5",
    //         artist: "Artist E",
    //         thumbnail: "https://via.placeholder.com/100x100?text=Favo5",
    //     },
    //       {
    //         musicID: 6,
    //         title: "Recommended Song 1",
    //         artist: "Artist X",
    //         thumbnail: "https://via.placeholder.com/100x100?text=Reco1",
    //       },
    //       {
    //         musicID: 7,
    //         title: "Recommended Song 2",
    //         artist: "Artist Y",
    //         thumbnail: "https://via.placeholder.com/100x100?text=Reco2",
    //       },
    //       {
    //         musicID: 8,
    //         title: "Recommended Song 3",
    //         artist: "Artist Z",
    //         thumbnail: "https://via.placeholder.com/100x100?text=Reco3",
    //       },
    //       {
    //         musicID: 9,
    //         title: "Recommended Song 4",
    //         artist: "Artist W",
    //         thumbnail: "https://via.placeholder.com/100x100?text=Reco4",
    //       },
    //       {
    //         musicID: 10,
    //         title: "Recommended Song 5",
    //         artist: "Artist V",
    //         thumbnail: "https://via.placeholder.com/100x100?text=Reco5",
    //       },
    //     ]}
    //     setRecentSearch(recoData.data);
    //     })();
    //   }, [])

    return (
        <>
        <div className="Search">
            <div className="header">
            <input type="search"
                placeholder="曲名・アーティスト名で検索"
                // value={searchParams?.category === SearchCategory.Title ? String(searchParams.queryValue) : ""} // 必要に応じて表示制御
                onChange={(event) => {
                    const value = event.target.value;
                    if (value === "") {
                        setSearchParams(null); // クエリが空ならリセット
                    }else{
                        setSearchParams({ queryValue: value, category: SearchCategory.Title });
                    }
                }} //アーティスト・楽曲名検索クエリ
                />
            </div>

            <div className="main">
            {
                (searchParams && searchParams.queryValue !== "" && searchParams.queryValue !== null && searchParams.queryValue !== undefined) ? (// 何らかの検索が実行された場合
                    <div className="search_result">
                        <div className="music-grid-container">
                        {musicList.map((music, index) => (
                            // 音楽表示用コンポーネントの作成
                            <MusicItemIcon
                                key={music.music_id}
                                musicID={music.music_id}
                                title={music.title}
                                artist={music.artist}
                                thumbnail={music.thumbnail}
                            />
                        ))}
                        </div>
                        {musicList.length === 0 && (
                            <p style={{ paddingLeft: '10px', color: 'gray' }}>検索結果はありません。</p>
                        )}
                    </div>
                 ) : (// 初期表示または検索クエリがクリアされた場合
                    <>
                    <div className="recentSearch">
                        <b style={{paddingLeft: '10px'}}>最近の検索</b>
                        {(recentSearch.length > 0) ? (
                            <div className="horizontal-scroll-container">
                                {recentSearch.map((music) => (
                                    <MusicItemIcon
                                        key={music.music_id}
                                        musicID={music.music_id}
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
                                        <button key={level} onClick={() => setSearchParams({ queryValue: level, category: SearchCategory.Difficulty })}>
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
                                    <button key={index} style={{'--line-color': lineColor }} onClick={() => setSearchParams({ queryValue: genre, category: SearchCategory.Genre })}>
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
