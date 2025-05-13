import { LinkButton } from "./components/test/link";
import { Navbar } from './components/Navbar';
import { MusicItemList } from "./components/musicItemList";
import { useState, useEffect, useCallback} from "react";
import axios from "axios";
import debounce from "lodash/debounce";

type DysplayMusic ={
    musicID : number;
    title : string;
    artist : string;
    thumbnail : string;//画像のURL? 画像そのもの？
}
export const Search = () => {//検索画面と結果表示画面をもつ
    const title: string = "検索画面";
    const [searchQuery, setSearchQuery] = useState<any>("");
    const [musicList, setMusicList] = useState<DysplayMusic[]>([]);

    const fetchMusic = useCallback(//検索クエリを元に音楽リストを取得する関数
        // debounceを使用して、入力が止まってから500ms後に実行
        // useCallbackを使用して、関数をメモ化?
        debounce(async (query: string) => {
            // console.log(musicList);
            if (!query) {
                setMusicList([]);
                return;
            }
            try {
                // const response = await axios.get(`http://localhost:8080/search?${query}`);
                // setMusicList(response.data);
                // ここではダミーデータを使用
                // 変更するたびに要素が追加されるダミー
                const test = "test"+query;
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
      
      useEffect(() => {// 検索クエリが変更されたときにfetchMusicを呼び出す
        fetchMusic(searchQuery);
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
                        setSearchQuery("title="+event.target.value);
                    }
                }} //アーティスト・楽曲名検索クエリ
                />
            </div>
            
            {
                (musicList.length > 0) ? (//検索クエリが存在している場合の画面
                    <div>
                        {musicList.map((music, index) => (
                            // 音楽表示用コンポーネントの作成
                        <div key={index}>
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
                            <button key={level} onClick={() => setSearchQuery(`difficulty=${level}`)}>
                                難易度{level}
                            </button>
                            );
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