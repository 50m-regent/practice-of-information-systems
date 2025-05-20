import { LinkButton } from "./components/test/link";
import { Navbar } from './components/Navbar';
import { MusicItemList } from "./components/musicItemList";
import { useState, useEffect, useCallback} from "react";
import axios from "axios";
import debounce from "lodash/debounce";
import { DysplayMusic, Genre, SearchCategory, SearchQuery } from "./types/types";


export const Search = () => {//検索画面と結果表示画面をもつ
    const title: string = "検索画面";
    const [searchQuery, setSearchQuery] = useState<SearchQuery>("");
    const [searchCategory, setSearchCategory] = useState<SearchCategory>("");
    const [musicList, setMusicList] = useState<DysplayMusic[]>([]);
    const [genreList, setGenreList] = useState<Genre[]>([]);
    // const [recentSearch, setRecentSearch] = useState<DysplayMusic[]>([]);

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
    return (
        <>
        <div className="Search">
            <div>
            <input type="search" 
                size="30" 
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
            
            {
                (musicList.length > 0) ? (//検索クエリが存在している場合の画面
                    <div>
                        {musicList.map((music, index) => (
                            // 音楽表示用コンポーネントの作成
                        <div key={music.musicID}>
                        <MusicItemList
                            musicID={music.musicID}
                            title={music.title}
                            artist={music.artist}
                            thumbnail={music.thumbnail}
                        />
                        </div>
                        ))}
                    </div>
                 ) : (//検索クエリが存在しない場合の画面
                    <div>
                    <p>直近の検索~未実装~</p>
                        <div>
                        {[...Array(9)].map((_, i) => {
                            const level = i + 1;
                            return (
                            <button key={level} onClick={() => {setSearchCategory(SearchCategory.Difficulty); setSearchQuery(level)}}>
                                難易度{level}
                            </button>
                            );
                        })}
                        </div>
                        <div>
                            <p>ジャンル検索</p>
                            {genreList.map((genre, index) => {
                                return (
                                    <button key={index} onClick={() => {setSearchCategory(SearchCategory.Genre); setSearchQuery(genre)}}>
                                        {genre}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )
            }
        </div>
        <Navbar />
        </>
    );
}