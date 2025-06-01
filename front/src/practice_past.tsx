import { LinkButton } from "./components/test/link";
import { Navbar } from './components/Navbar'; // Navbarが使用されていませんが、そのまま残します
import { useRef, useEffect, useState, use } from 'react';
import { useLocation } from "react-router-dom";
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { OSMDPlayer } from './components/OSMDPlayer';
import { Difficulty } from './types/types';
// import axios from "axios"; // axiosが使用されていませんが、そのまま残します

/**
 * 楽譜の指定された小節を別の楽譜の小節で置き換える関数
 * @param musicXmlA 変更対象のMusicXML文字列
 * @param musicXmlB 変更元のMusicXML文字列
 * @param measureNumber 変更する小節の番号 (文字列)
 * @returns 変更後のMusicXML文字列、またはエラーの場合はnull
 */
async function replaceMeasure(
    musicXmlA: string,
    musicXmlB: string,
    measureNumber: string
): Promise<string | null> {
    try {
        const parser = new DOMParser();
        const serializer = new XMLSerializer();

        const xmlDocA = parser.parseFromString(musicXmlA, 'application/xml');
        const xmlDocB = parser.parseFromString(musicXmlB, 'application/xml');

        // B楽譜から指定された小節をクローンして取得
        const measureB = xmlDocB.querySelector(`measure[number="${measureNumber}"]`);
        if (!measureB) {
            console.error(`B楽譜に${measureNumber}小節目は見つかりません`);
            return null;
        }
        const clonedMeasureBChildren = Array.from(measureB.childNodes).map(node => node.cloneNode(true));

        // A楽譜から指定された小節を見つける
        const measureA = xmlDocA.querySelector(`measure[number="${measureNumber}"]`);
        if (!measureA) {
            console.error(`A楽譜に${measureNumber}小節目は見つかりません`);
            return null;
        }

        // A楽譜の小節の内容をクリアし、B楽譜の内容で置き換える
        while (measureA.firstChild) {
            measureA.removeChild(measureA.firstChild);
        }
        clonedMeasureBChildren.forEach(child => {
            measureA.appendChild(child);
        });

        // 変更後のXML文字列を返す
        return serializer.serializeToString(xmlDocA);
    } catch (error) {
        console.error('楽譜の処理中にエラーが発生しました:', error);
        return null;
    }
}

export const Practice = () => {
    const title: string = "楽譜表示画面"; // ページタイトル
    const location = useLocation(); // URLのクエリパラメータ取得用

    // --- Refオブジェクト ---
    const mainDivRef = useRef<HTMLDivElement>(null); // OSMDを描画するDOM要素への参照
    const osmdInstanceRef = useRef<OpenSheetMusicDisplay | null>(null); // OpenSheetMusicDisplayインスタンスへの参照
    const scrollContainerRef = useRef<HTMLDivElement>(null); // スクロール可能なコンテナ要素への参照

    // --- 状態管理 ---
    const [difficulty, setDifficulty] = useState<Difficulty>(0); // 現在の難易度 (0-5)
    const [userProficiency, setUserProficiency] = useState<number>(1); // ユーザの習熟度 (0-100、現在未使用)
    const [musicXmls, setMusicXmls] = useState<string[]>([]); // 読み込んだ楽譜のMusicXML文字列配列

    // --- 定数 ---
    const ZOOM_RATE = 0.75; // 楽譜の表示ズーム率

    // --- ヘルパー関数 ---

    /**
     * スクロールコンテナの現在のスクロール位置を保存します。
     * @returns 現在のスクロール位置 (scrollTop値)
     */
    const saveScrollPosition = (): number => {
        return scrollContainerRef.current
            ? scrollContainerRef.current.scrollTop
            : 0;
    };

    /**
     * スクロールコンテナのスクロール位置を復元します。
     * @param scrollTop 復元するスクロール位置
     */
    const restoreScrollPosition = (scrollTop: number) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollTop;
        }
    };

    /**
     * 難易度変更時のコールバックハンドラ
     * @param newDifficulty 新しい難易度
     */
    const handleDifficultyChange = (newDifficulty: Difficulty) => {
        setDifficulty(newDifficulty);
    };

    /**
     * XML2の楽譜データの指定小節を、現在の表示楽譜の対応小節で置き換えるハンドラ
     * @param xmlToReplaceWith 置き換え元となるMusicXML文字列
     * @param measureNumber 置き換える小節の番号
     */
    const handleReplaceMeasure = async (xmlToReplaceWith: string | null, measureNumber: number) => {
        // 現在表示されている楽譜 (難易度0の楽譜を想定)
        const currentDisplayedXml = musicXmls[0];

        if (!currentDisplayedXml || !xmlToReplaceWith) {
            console.error("楽譜データが読み込まれていないか、置き換え元のデータがありません。");
            return;
        }

        // 小節を置き換える
        const updatedXmlString = await replaceMeasure(currentDisplayedXml, xmlToReplaceWith, measureNumber.toString());

        if (updatedXmlString) {
            // 現在のXML配列のコピーを作成し、更新
            const newXmlArray = [...musicXmls];
            newXmlArray[0] = updatedXmlString; // 最初の楽譜 (メイン表示楽譜) を更新
            setMusicXmls(newXmlArray); // 状態を更新して再描画をトリガー
            console.log(`小節 ${measureNumber} が置き換えられました。`);
        }
    };

    /**
     * 小節番号を指定して楽譜をスクロールします。
     * @param measureNumber スクロールしたい小節の番号
     */
    const handleScrollToMeasure = (measureNumber: number) => {
        const container = scrollContainerRef.current;
        const mainDiv = mainDivRef.current;
        if (!container || !mainDiv) return;

        // 小節番号（id）を指定
        const measureId = measureNumber.toString();

        // 該当するSVG要素を探す
        const svgMeasure = mainDiv.querySelector(`g.vf-measure[id="${measureId}"]`);
        if (!svgMeasure) {
            console.warn(`小節 ${measureId} のSVG要素が見つかりません`);
            return;
        }

        // 要素の画面上の位置を取得し、スクロールコンテナの座標系に変換してスクロール
        const svgRect = svgMeasure.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        const scrollTop = container.scrollTop + (svgRect.top - containerRect.top);
        container.scrollTop = scrollTop;
        
        console.log(`スクロール位置を小節 ${measureId} に移動しました`);
    };
    
    // --- 初期化と副作用 (useEffect) ---

    // OSMDインスタンスの初期化
    useEffect(() => {
        if (mainDivRef.current && !osmdInstanceRef.current) { // インスタンスがまだない場合のみ初期化
            osmdInstanceRef.current = new OpenSheetMusicDisplay(mainDivRef.current, {
                backend: "svg",
                drawTitle: true,
                autoResize: true, // コンテナのリサイズに追従
            });
        }
        // コンポーネントアンマウント時のクリーンアップは不要、OSMDPlayerで管理されるため
    }, []); // 依存配列が空なので、コンポーネントマウント時に一度だけ実行

    // 楽譜の読み込み (URLのmusicIDまたは難易度に基づいて)
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const musicId = queryParams.get("musicID");
        console.log(`URLからのmusicID:`, musicId);

        if (!musicId) {
            console.warn("URLにmusicIDが見つかりません。楽譜を読み込めません。");
            setMusicXmls([]); // IDがない場合はXMLをクリア
            return;
        }

        const loadScores = async () => {
            try {
                console.log(`musicID ${musicId} の楽譜を取得中...`);

                let fetchedXmls: string[] = [];
    
                // メインの楽譜をバックエンドから取得する例（コメントアウトされています）
                // let response = await fetch(`http://localhost:8000/getscore?musicID=${musicId}`);
                // if (!response.ok) throw new Error(`バックエンドからの楽譜取得に失敗: ${response.statusText}`);
                // let text = await response.text();
                // fetchedXmls.push(text);

                // ローカルのXMLファイルを読み込む例 (テスト用またはバリエーション用)
                // 現在はmusicIDに関わらず固定のファイルを読み込んでいますが、
                // 実際にはmusicIdやdifficultyに応じて動的にパスを構築する必要があります。
                // 例: 難易度0のメイン楽譜
                let a = userProficiency === 0 ? 1 : difficulty; // ユーザの習熟度が0なら難易度0、そうでなければ現在の難易度を使
                let responseAuto = await fetch(`/xml/uchudekiritan${a}.musicxml`);
                // let responseAuto = await fetch(`/xml/testsheet_pick.xml`);
                if (!responseAuto.ok) throw new Error(`testsheet_pick.xmlの読み込みに失敗: ${responseAuto.statusText}`);
                let textAuto = await responseAuto.text();
                fetchedXmls.push(textAuto); // 難易度0 (自動) の楽譜として追加

                // 難易度1〜5のバリエーション楽譜を読み込む例
                for (let i = 1; i <= 5; i++) {
                    const responseVariant = await fetch(`/xml/uchudekiritan${i}.musicxml`);
                    if (!responseVariant.ok) throw new Error(`uchudekiritan${i}.musicxmlの読み込みに失敗: ${responseVariant.statusText}`);
                    const textVariant = await responseVariant.text();
                    fetchedXmls.push(textVariant);
                }
    
                setMusicXmls(fetchedXmls); // 読み込んだXML配列で状態を更新
                console.log(`計 ${fetchedXmls.length} 個のXML楽譜バージョンを正常に取得しました。`);
                
            } catch (error) {
                console.error('楽譜の読み込み中にエラーが発生しました:', error);
                setMusicXmls([]); // エラー時はXMLをクリア
            }
        };

        loadScores();
    }, []); // location.search, difficulty, userProficiencyが変更されたら再実行

    // `musicXmls` または `difficulty` が更新されたときに楽譜を再描画
    useEffect(() => {
        // 現在の難易度に対応するXMLがあるか確認
        const currentXmlToDisplay = musicXmls[difficulty];

        if (currentXmlToDisplay && osmdInstanceRef.current) {
            // 楽譜変更後もその場にとどまるようにスクロール位置を保存
            const savedScrollTop = saveScrollPosition();
            
            const parser = new DOMParser();
            const parsedXml = parser.parseFromString(currentXmlToDisplay, 'application/xml');

            osmdInstanceRef.current.load(parsedXml)
                .then(() => {
                    osmdInstanceRef.current?.render(); // 楽譜をレンダリング
                    restoreScrollPosition(savedScrollTop); // 保存したスクロール位置を復元

                    // OSMDPlayer側でカーソルの表示・非表示・リセットを管理するため、
                    // ここでのカーソル操作は基本的に不要ですが、初期表示時の確認用として残します。
                    // const cursor = osmdInstanceRef.current?.cursor;
                    // if (cursor) {
                    //     cursor.show();
                    //     cursor.reset();
                    //     // 例: 最初の20音符分カーソルを進める
                    //     for (let i = 0; i < 20; i++) {
                    //         cursor.next();
                    //     }
                    //     console.log("初期カーソル位置:", cursor.iterator);
                    // }
                })
                .catch((err) => console.error('OSMD 楽譜の再描画エラー:', err));
        } else if (!currentXmlToDisplay && musicXmls.length > 0) {
            console.warn(`難易度 ${difficulty} に対応する楽譜XMLが見つかりません。`);
        }
    }, [musicXmls, difficulty]); // musicXmlsまたはdifficultyが変更されたら実行

    // --- UIレンダリング ---
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <header style={{ padding: '1rem', background: '#f0f0f0', flexShrink: 0 }}>
                <LinkButton text="ホーム画面" link="/home" />
                {/* 難易度調整ボタンなど、必要に応じてここにUI要素を追加 */}
                {/* <button onClick={() => handleReplaceMeasure(xmlB, 3)}>小節3をBから差し替え</button> */}
            </header>
            <main
                ref={scrollContainerRef}
                style={{
                    flexGrow: 1, // 残りのスペースを全て占める
                    overflow: 'auto', // スクロール可能にする
                    background: '#ffffff',
                    padding: '1rem',
                    // zoomプロパティはCSS標準ではないため、transform: scale() の方が推奨されますが、
                    // 簡易的なズームとして残します。
                    width: `${100 / ZOOM_RATE}vw`, 
                    zoom: `${ZOOM_RATE}`, 
                }}
            >
                {/* 楽譜描画エリア */}
                <div ref={mainDivRef} />
            </main>
            <footer style={{ padding: '1rem', background: '#f0f0f0', flexShrink: 0, width: '100vw' }}>
                <p style={{ margin:0 }}>フッター</p>
                {/* OSMDPlayerコンポーネントを配置 */}
                {osmdInstanceRef.current && ( // OSMDインスタンスがある場合のみレンダリング
                    <OSMDPlayer
                        mainOsmd={osmdInstanceRef} // 名前をmainOsmdに合わせる
                        difficulty={difficulty}
                        onDifficultyChange={handleDifficultyChange}
                        accompanimentXml={musicXmls[1]} // 例: 難易度1の楽譜を伴奏として渡す
                    />
                )}
            </footer>
        </div>
    );
};