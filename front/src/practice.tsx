import { LinkButton } from "./components/test/link";
import { Navbar } from './components/Navbar';
import { useRef, useEffect, useState } from 'react';
import { useLocation } from "react-router-dom";
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { OSMDPlayer } from './components/OSMDPlayer';
import { Difficulty } from './types/types';
// import axios from "axios";

// 楽譜を小節単位で変更する
async function replaceMeasure(
    musicXmlA: string,      // この楽譜の小節を変更
    musicXmlB: string,      // 変更する小節を持つ楽譜
    measureNumber: string   // 変更する小節番号
): Promise<string | null> {
    try {
        const parser = new DOMParser();
        const serializer = new XMLSerializer();

        const xmlDocA = parser.parseFromString(musicXmlA, 'application/xml');
        const xmlDocB = parser.parseFromString(musicXmlB, 'application/xml');

        const measureB = xmlDocB.querySelector(`measure[number="${measureNumber}"]`);
        if (!measureB) {
            console.error(`B楽譜に${measureNumber}小節目は見つかりません`);
            return null;
        }
        const clonedMeasureBChildren = Array.from(measureB.childNodes).map(node => node.cloneNode(true));

        const measureA = xmlDocA.querySelector(`measure[number="${measureNumber}"]`);
        if (!measureA) {
            console.error(`A楽譜に${measureNumber}小節目は見つかりません`);
            return null;
        }

        while (measureA.firstChild) {
            measureA.removeChild(measureA.firstChild);
        }
        clonedMeasureBChildren.forEach(child => {
            measureA.appendChild(child);
        });

        return serializer.serializeToString(xmlDocA);
    } catch (error) {
        console.error('楽譜の処理中にエラーが発生しました:', error);
        return null;
    }
}

export const Practice = () => {
    const title: string = "楽譜表示画面";
    const location = useLocation(); // Moved useLocation to the top level
    const zoom_rate=0.75;
    const divRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<any>(null);
    // const bpm = 120; // 任意のテンポ
    // const quarterNoteMs = 60000 / bpm;
    // const baseNoteValue = 0.25; // 4分音符 = 0.25
    let intervalId: any = null;
    const [difficulty, setDifficulty] = useState<Difficulty>(0);
    const [userProficiency, setUserProficiency] = useState<number>(1); // ユーザの習熟度を0-100で管理
    // 表示する楽譜の内容はstring型でxmlに格納
    // 楽譜表示の際などはその都度xml形式に変換してください
    const [xml, setXml] = useState<string[]>([]);
   
    // const [musicClip, setMusicClip] = useRef<[number, number][]>([]);

    // スクロール位置を保存する
    const saveScrollPosition = () => {
        return scrollContainerRef.current
            ? scrollContainerRef.current.scrollTop
            : 0;
    };

    // スクロール位置を復元する
    const restoreScrollPosition = (scrollTop: number) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollTop;
        }
    };

    // 初期化: OSMDのインスタンス生成
    useEffect(() => {
        if (divRef.current) {
            osmdRef.current = new OpenSheetMusicDisplay(divRef.current,{
            backend: "svg",
            drawTitle: true,
            autoResize: true,
        });
        }
    }, []);

    // 楽譜の読み込み
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const id = queryParams.get("musicID");
        console.log(`Current musicID from URL:`, id);

        if (!id) {
            console.warn("musicID not found in URL. Cannot load specific scores.");
            setXml([]); // Clear XMLs if no ID is present
            return;
        }

        (async () => {
            try {
                console.log(`Fetching scores for musicID: ${id}`);

                let newXmls = [];
    
                // Fetch the main score based on musicID from the backend
                // let response = await fetch(`http://localhost:8000/getscore?musicID=${id}`);
                // if (!response.ok) throw new Error(`Failed to fetch /xml/testsheet_pick.xml: ${response.statusText}`);
                // let text = await response.text();
                // newXmls.push(text);

                // Load additional local XML files (e.g., for different difficulties or variations)
                // If these also need to be dynamic based on musicID, the API and fetch logic here would need adjustment.
                // console.log(`Loading musicxml/uchudekiritan${i}.musicxml`); // Example of specific file
                let i = 1;
                // let response = await fetch(`/xml/testsheet_pick.xml`);
                let response = await fetch(`/xml/yoaketohotaru.musicxml`);
                // let response = await fetch(`/xml/uchudekiritan${i}.musicxml`);
                // if (!response.ok) throw new Error(`Failed to fetch /xml/uchudekiritan${i}.musicxml: ${response.statusText}`);
                let text = await response.text();
                newXmls.push(text);
                for (let i = 1; i <= 5; i++) {
                    // console.log(`Loading musicxml/uchudekiritan${i}.musicxml`); // Example of specific file
                    let response = await fetch(`/xml/uchudekiritan${i}.musicxml`);
                    if (!response.ok) throw new Error(`Failed to fetch /xml/uchudekiritan${i}.musicxml: ${response.statusText}`);
                    let text = await response.text();
                    newXmls.push(text);
                }
    
                setXml(newXmls); // Replace existing XMLs with the newly loaded set
                console.log(`Fetched ${newXmls.length} XML score versions successfully.`);
                
                
            } catch (error) {
                console.error('楽譜の読み込みに失敗しました:', error);
                setXml([]); // Clear XMLs on error
            }
        })();
    }, [location.search, userProficiency]); // Added location.search to dependencies.
                                          // userProficiency is included if it's intended to affect loading,
                                          // though current fetch logic doesn't use it directly.


    // xmlが更新されたときに再描画
    useEffect(() => {
        if (xml[difficulty] && osmdRef.current) {
            // 楽譜変更後もその場にとどまるようにスクロール位置を保存
            const scrollTop = saveScrollPosition();
            // console.log(scrollTop)
            
            const parser = new DOMParser();
            const parsedXml = parser.parseFromString(xml[difficulty], 'application/xml');
            osmdRef.current.load(parsedXml)
                .then(() => {
                    osmdRef.current?.render();
                    restoreScrollPosition(scrollTop); // スクロール位置を復元
                const cursor = osmdRef.current?.cursor;
                if (cursor) {
                    cursorRef.current = cursor;
                    cursor.show();
                    cursor.reset();
                    // cursorRef.current.next();
                    // cursorRef.current.next();
                    for (let i = 0; i < 20; i++) {
                        cursorRef.current.next(); 
                    }
                    console.log(cursorRef.current);
                }
                })
                .catch((err) => console.error('OSMD 再描画エラー:', err));
        }
    }, [xml, difficulty]); // Dependency on xml and difficulty

    // Handler for difficulty changes from OSMDPlayer
    const handleDifficultyChange = (newDifficulty: Difficulty) => {
        setDifficulty(newDifficulty);
    };

    // xml2 の楽譜データの measureNumber 小節で xml の内容を変更します
    const handleReplace = async (xml2: string | null, measureNumber: number) => {
        if (!xml[0] || !xml2) {
            console.error("楽譜データが読み込まれていません。");
            return;
        }

        const currentXmlToUpdate = xml[0];
        const updatedXmlString = await replaceMeasure(currentXmlToUpdate, xml2, measureNumber.toString());

        if (updatedXmlString) {
            const newXmlArray = [...xml]; // Create a copy of the current xml array
            newXmlArray[0] = updatedXmlString; // Update the specific xml string
            setXml(newXmlArray); // Set the new array to state
            console.log(`Sheet changed for difficulty`);
        }
    };
    // 小節番号を指定してスクロールする関数
    // const handleScrollToMeasure = (measureNumber: number) => {
    //     const container = scrollContainerRef.current;
    //     const div = divRef.current;
    //     if (!container || !div) return;

    //     // 小節番号（id）を指定
    //     const measureId = measureNumber.toString();

    //     // 該当する g.vf-measure 要素を探す
    //     const svgMeasure = div.querySelector(`g.vf-measure[id="${measureId}"]`);
    //     if (!svgMeasure) {
    //         console.warn(`小節 ${measureId} のSVG要素が見つかりません`);
    //         return;
    //     }

    //     // 要素の画面上の位置を取得し、スクロールコンテナの座標系に変換
    //     const svgRect = svgMeasure.getBoundingClientRect();
    //     const containerRect = container.getBoundingClientRect();
        
    //     // scrollTop の調整量を計算してスクロール
    //     console.log(`container.ScrollTop: ${container.scrollTop}`);
    //     console.log(`svgRect.top: ${svgRect.top}`);
    //     console.log(`containerRect.top: ${containerRect.top}`);
    //     const scrollTop = container.scrollTop + (svgRect.top - containerRect.top);
    //     console.log(`scrollTop: ${scrollTop}`);
    //     container.scrollTop = scrollTop;
    //     // const targetScrollTop = container.scrollTop + (svgRect.top - containerRect.top);
    //     // container.scrollTo({
    //     //     top: targetScrollTop,
    //     //     behavior: 'smooth' 
    //     // });
        
    //     console.log(`スクロール位置を小節 ${measureId} に移動しました`);
    // };

    const handleScrollToMeasure = (measureNumber: number) => {
        const container = scrollContainerRef.current; // 事前に定義されたrefであると仮定します
        const div = divRef.current; // 事前に定義されたrefであると仮定します

        // zoom_rate がこのスコープでアクセス可能であると仮定します。
        // (例: コンポーネントのstate、props、または上位スコープの定数)
        // const zoom_rate = 0.75; // これは実際の zoom_rate の値に置き換えてください。

        if (!container || !div) {
            console.error("[DEBUG] Container or div ref is not available.");
            return;
        }

        const measureId = measureNumber.toString();
        const svgMeasure = div.querySelector(`g.vf-measure[id="${measureId}"]`);

        if (!svgMeasure) {
            console.warn(`[DEBUG] SVG Measure ${measureId} not found.`);
            return;
        }

        let referenceTopY: number;
        // 対象小節が含まれる段グループ (g.vf-system または g.vf-stave) を取得
        const lineGroup = svgMeasure.closest('g.staffline') || svgMeasure.closest('g.vf-stave');

        if (lineGroup) {
            // 段グループ要素自体の上端を基準y座標とする
            referenceTopY = lineGroup.getBoundingClientRect().top;
        } else {
            // 段グループが見つからない場合は、フォールバックとして対象小節自身の上端を使う
            console.warn(`[DEBUG] Line group not found for measure ${measureId}. Using the measure itself as reference.`);
            referenceTopY = svgMeasure.getBoundingClientRect().top;
        }

        const containerRect = container.getBoundingClientRect();
        const desiredVisualMarginPx = 20; // 希望する視覚的なマージン (ピクセル単位)

        // 1. 段の上端の、コンテナ上端からの「論理的な」オフセットを計算
        const logicalOffsetOfLineFromContainerTop = (referenceTopY - containerRect.top) / zoom_rate;

        // 2. 段の「コンテナのコンテンツ先頭からの絶対的な論理オフセット」を計算
        //    (現在のスクロール位置 + 現在のビューでの段の論理的なオフセット)
        const absoluteLogicalOffsetOfLine = container.scrollTop + logicalOffsetOfLineFromContainerTop;

        // 3. 目標マージンの「論理的な」値を計算
        const logicalMargin = desiredVisualMarginPx / zoom_rate;

        // 4. 目標とするscrollTopは、段の絶対論理オフセットから論理マージンを引いた値
        let targetScrollTop = absoluteLogicalOffsetOfLine - logicalMargin;

        // scrollTop が負の値にならないように0でクランプする
        targetScrollTop = Math.max(0, targetScrollTop);

        const currentScrollTopBeforeSet = container.scrollTop; // 設定前のscrollTopをログ用に保持
        container.scrollTop = targetScrollTop; // スクロール位置を設定

        // デバッグログ
        console.log(`[DEBUG] measureNumber: ${measureNumber}`);
        console.log(`[DEBUG] container.scrollTop (before set): ${currentScrollTopBeforeSet.toFixed(2)}`);
        console.log(`[DEBUG] referenceTopY (from lineGroup or svgMeasure): ${referenceTopY.toFixed(2)}`);
        console.log(`[DEBUG] containerRect.top: ${containerRect.top.toFixed(2)}`);
        console.log(`[DEBUG] zoom_rate: ${zoom_rate}`); // zoom_rateが正しく参照されているか確認
        console.log(`[DEBUG] logicalOffsetOfLineFromContainerTop: ${logicalOffsetOfLineFromContainerTop.toFixed(2)}`);
        console.log(`[DEBUG] absoluteLogicalOffsetOfLine: ${absoluteLogicalOffsetOfLine.toFixed(2)}`);
        console.log(`[DEBUG] desiredVisualMarginPx: ${desiredVisualMarginPx}`);
        console.log(`[DEBUG] logicalMargin: ${logicalMargin.toFixed(2)}`);
        console.log(`[DEBUG] targetScrollTop (calculated): ${targetScrollTop.toFixed(2)}`);
        console.log(`[DEBUG] container.scrollTop (after set): ${container.scrollTop.toFixed(2)}`);
    };
    
    // async function startCursorPlayback(bpm: number) {
    //     const cursor = cursorRef.current;
    //     console.log(cursorRef.current);
    //     if (!cursor) return;
        
    //     // divisionsを取得（例: scoreの最初のattributes要素から）
    //     const divisions = cursorRef.current.MusicPartManager.CurrentPartList[0].MusicPart.FirstMeasure.Attributes.Divisions || 1;
        
    //     const msPerDivision = (60000 / bpm) / divisions;
        
    //     async function playNext() {
    //         if (cursorRef.current.Iterator.EndReached) {
    //             cursorRef.current.reset();
    //             return;
    //         }
            
    //         cursorRef.current.next();
            
    //         // 現在の音符（VoiceEntry）を取得
    //         const currentVoiceEntries = cursorRef.current.Iterator.CurrentVoiceEntries;
    //         if (!currentVoiceEntries || currentVoiceEntries.length === 0) {
    //             setTimeout(playNext, msPerDivision); // 音符なしはとりあえず1division待つ
    //             return;
    //         }
            
    //         // 代表的に1つめの音符のdurationを取得（複数音符ある場合は工夫要）
    //         const note = currentVoiceEntries[0].Notes[0];
    //         const duration = note?.Notehead?.Length || note?.NoteLength || note?.Duration || 1; // OSMD内部プロパティ名は要確認
            
    //         // durationはMusicXMLのdurationではない可能性もあるので要確認
            
    //         // durationをmsに変換
    //         const waitMs = duration * msPerDivision;
            
    //         setTimeout(playNext, waitMs);
    //     }
        
    //     playNext();
    // }


    // function midiNoteNumberToFrequency(midiNoteNumber: number): number {
    //     return 440 * Math.pow(2, (midiNoteNumber - 69) / 12);
    // }

    // function playBeep(frequency = 440, durationMs = 250) {
    //     const context = new AudioContext();
    //     const oscillator = context.createOscillator();
    //     oscillator.type = 'sine';
    //     oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    //     oscillator.connect(context.destination);
    //     oscillator.start();
    //     oscillator.stop(context.currentTime + durationMs / 1000);
    // }


    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <header style={{ padding: '1rem', background: '#f0f0f0', flexShrink: 0 }}>
            <LinkButton text="ホーム画面" link="/home" />
            <button onClick={() => handleScrollToMeasure(2)}>スクロール1</button>
            <button onClick={() => handleScrollToMeasure(6)}>スクロール2</button>
            <button onClick={() => handleScrollToMeasure(12)}>スクロール3</button>
            <button onClick={() => handleScrollToMeasure(40)}>スクロール4</button>
            <button onClick={() => handleScrollToMeasure(80)}>スクロール5</button>
            {/* <button onClick={() => handleReplace2(xmlB, num)}>Bから小節差し替え</button> */}
        </header>
        <main
            ref={scrollContainerRef}
            style={{
                    flexGrow: 1,
                    overflow: 'auto',
                    background: '#ffffff',
                    padding: '1rem',
                    width: `${100/zoom_rate}vw`,
                    zoom: `${zoom_rate}`, // 初期ズームレベル
                }}
        >
            <div ref={divRef} />
            <div style={{ height: '100vh' }} /> 
        </main>
        <footer style={{ padding: '1rem', background: '#f0f0f0', flexShrink: 0 ,width: '100vw'}}>
            <p style={{ margin:0 }}>フッター</p>
            {osmdRef.current && (
                <OSMDPlayer osmd={osmdRef as React.RefObject<OpenSheetMusicDisplay>} difficulty={difficulty} onDifficultyChange={handleDifficultyChange} />
            )}
        </footer>
        </div>
    );
}
