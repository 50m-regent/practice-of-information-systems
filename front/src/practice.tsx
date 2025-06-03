import { LinkButton } from "./components/test/link"; // パスを確認してください
import { useRef, useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from "react-router-dom"; // useNavigate を追加
import { OpenSheetMusicDisplay, Cursor } from 'opensheetmusicdisplay';
import { OSMDPlayer } from './components/OSMDPlayer';
import { Difficulty } from './types/types';
import { IoHeartSharp } from 'react-icons/io5'; // ハートアイコンをインポート
import axios from "axios";
// import axios from 'axios'; // 未使用であれば削除して問題ありません

// 既存の replaceMeasure 関数 (変更なし)
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
        const measureB = xmlDocB.querySelector(`measure[number="${measureNumber}"]`);
        if (!measureB) {
            console.error(`[replaceMeasure] B楽譜に${measureNumber}小節目は見つかりません`);
            return null;
        }
        const clonedMeasureBChildren = Array.from(measureB.childNodes).map(node => node.cloneNode(true));
        const measureA = xmlDocA.querySelector(`measure[number="${measureNumber}"]`);
        if (!measureA) {
            console.error(`[replaceMeasure] A楽譜に${measureNumber}小節目は見つかりません`);
            return null;
        }
        while (measureA.firstChild) {
            measureA.removeChild(measureA.firstChild);
        }
        clonedMeasureBChildren.forEach(child => {
            measureA.appendChild(child)
        });
        return serializer.serializeToString(xmlDocA);
    } catch (error) {
        console.error('[replaceMeasure] 楽譜の処理中にエラーが発生しました:', error);
        return null;
    }
}

// 既存の replaceMeasuresFrom 関数 (変更なし)
async function replaceMeasuresFrom(
    musicXmlA: string,
    musicXmlB: string,
    startMeasureNumberAttribute: string
): Promise<string | null> {
    try {
        const parser = new DOMParser();
        const serializer = new XMLSerializer();
        const xmlDocA = parser.parseFromString(musicXmlA, "application/xml");
        const xmlDocB = parser.parseFromString(musicXmlB, "application/xml");

        if (xmlDocA.getElementsByTagName("parsererror").length > 0) {
            console.error('[replaceMeasuresFrom] Failed to parse musicXmlA.');
            const errorNode = xmlDocA.getElementsByTagName("parsererror")[0];
            console.error(errorNode?.textContent || "Unknown parsing error in musicXmlA");
            return null;
        }
        if (xmlDocB.getElementsByTagName("parsererror").length > 0) {
            console.error('[replaceMeasuresFrom] Failed to parse musicXmlB.');
            const errorNode = xmlDocB.getElementsByTagName("parsererror")[0];
            console.error(errorNode?.textContent || "Unknown parsing error in musicXmlB");
            return null;
        }

        const measuresInBMap = new Map<string, Element>();
        xmlDocB.querySelectorAll("measure").forEach(measureElement => {
            const numAttr = measureElement.getAttribute("number");
            if (numAttr) {
                measuresInBMap.set(numAttr, measureElement);
            }
        });

        const measuresInA = Array.from(xmlDocA.querySelectorAll("measure"));
        let processingStarted = false;

        for (const measureA of measuresInA) {
            const currentMeasureNumberInA = measureA.getAttribute("number");
            if (!currentMeasureNumberInA) {
                continue;
            }

            if (!processingStarted && currentMeasureNumberInA === startMeasureNumberAttribute) {
                processingStarted = true;
            }

            if (processingStarted) {
                const replacementSourceMeasureB = measuresInBMap.get(currentMeasureNumberInA);
                if (replacementSourceMeasureB) {
                    while (measureA.firstChild) {
                        measureA.removeChild(measureA.firstChild);
                    }
                    Array.from(replacementSourceMeasureB.childNodes).forEach(childNode => {
                        measureA.appendChild(childNode.cloneNode(true));
                    });
                }
            }
        }
        return serializer.serializeToString(xmlDocA);
    } catch (error) {
        console.error('[replaceMeasuresFrom] An error occurred during MusicXML processing:', error);
        return null;
    }
}

interface CursorPosition {
    measure: number;
    voiceEntry: number;
    part: number;
    timestamp: number;
}

export const Practice = () => {
    // title 変数はJSX内で直接使用しないため、必要に応じてコメントアウトまたは削除
    // const title: string = "楽譜表示画面"; 
    const ZOOM_RATE = 0.8;
    const MAX_DIFFICULTY: Difficulty = 5;
    const ACCOMPANIMENT_NUM = "-1";
    const AUTO_XML_NUM = 0;

    const location = useLocation();
    const navigate = useNavigate(); // useNavigate フックを使用
    const mainDivRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<Cursor | null>(null);

    const [difficulty, setDifficulty] = useState<Difficulty>(0);
    const [userProficiency, setUserProficiency] = useState<number>(1);
    const [xml, setXml] = useState<string[]>([]);
    const [titleData, setTitleData] = useState<string>("unknown title"); // 初期値を変更
    const [artistData, setArtistData] = useState<string>("unknown artist"); // 初期値を変更
    const [currentMusicID, setCurrentMusicID] = useState<string | null>(null); // ★ musicIDを保持するstate

    const measureDifficultiesRef = useRef<Difficulty[]>([]);
    const musicbpmRef = useRef<number>(120);
    const prevDifficultyRef = useRef<Difficulty>(difficulty);
    const cursorPositionToRestoreRef = useRef<CursorPosition | null>(null);
    const isUpdatingXmlForProficiencyRef = useRef<boolean>(false);
    const accompanimentXmlRef = useRef<string | null>(null);

    const saveScrollPosition = () => {return scrollContainerRef.current ? scrollContainerRef.current.scrollTop : 0};
    const restoreScrollPosition = (scrollTop: number) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollTop;
        }
    };
    
    // 既存の useEffect, useCallback フック (ロジック部分 - 変更なし)
    // ... (OSMD初期化 useEffect)
    useEffect(() => {
        if (mainDivRef.current && !osmdRef.current) {
            const instance = new OpenSheetMusicDisplay(mainDivRef.current, {
                backend: "svg", drawTitle: false, drawSubtitle: false, autoResize: true, 
                drawComposer: false, drawLyricist: false,
            });
            osmdRef.current = instance;
            cursorRef.current = instance.cursor; 
            console.log("[Practice] OSMDが初期化され、カーソルrefが設定されました。");
        }
    }, []);

    // ... (楽譜読み込み useEffect - タイトル/アーティスト設定部分のみ変更の可能性あり)
    useEffect(() => {
        let musicData: any = null
        const queryParams = new URLSearchParams(location.search);
        const musicId = queryParams.get("musicID");
        if (!musicId) {
            console.warn("[Practice] URLにmusicIDが見つかりません。"); // "[Practice] musicID not found in URL."
            setXml([]); return;
        }
        setCurrentMusicID(musicId);

        (async () => {
            try {
                console.log(`[Practice InitEffect] ユーザーの初期習熟度をAxios経由で取得中 (musicID: ${musicId})...`);
                const randomdata = await (async () => {return Math.floor(Math.random() * 4) + 2})(); // 1から5のランダムな難易度を生成
                console.log(`[Practice InitEffect] ランダムな習熟度データが生成されました: ${randomdata}`); // `[Practice InitEffect] Random proficiency data generated: ${randomdata}`
                // const responseProf = { data: {proficiency: randomdata} }; // 仮のデータ
                //==============================================
                const responseProf = await axios.get(`http://localhost:8080/proficiency`)
                // , {
                //     method: 'GET',
                // });
                // console.log(responseProf)
                
                const currentUserProficiency = responseProf.data;

                const requestBody = { // interface を使わずに直接オブジェクトを作成
                    music_id: Number(musicId),
                };

                // Goサーバーが動作しているURLに応じて変更してください
                const apiUrl = "http://localhost:8080/select";

                
                    try {
                        const responseSelect = await axios.post(apiUrl, requestBody, {
                            headers: {
                                "Content-Type": "application/json",
                                // 必要に応じて他のヘッダーを追加
                            },
                        });

                        console.log(responseSelect); // axiosのレスポンスオブジェクト全体をログに出力

                        // axiosはHTTPステータスコードが2xx以外の場合に自動的にエラーをスローするため、
                        // responseSelect.ok のチェックは不要です。
                        // エラーはcatchブロックで処理されます。

                        // axiosのレスポンスボディは responseSelect.data に格納されます
                        musicData = responseSelect.data; // GoのSelect APIの戻り値型に合わせる

                        // ここで取得したデータ (data) を使ってUIを更新するなどの処理
                        // 例: setMusicData(data);
                        console.log("選択された音楽データ:", musicData);

                    } catch (error) {
                        // axios のエラーハンドリング
                        if (axios.isAxiosError(error)) {
                            // AxiosErrorの場合、error.responseにサーバーからの応答が含まれる可能性がある
                            const status = error.response ? error.response.status : 'N/A';
                            const errorData: any = error.response ? error.response.data : { error: 'Unknown error or no response data' }; // エラーレスポンスデータ
                            
                            console.error(`APIリクエスト失敗: ${apiUrl} ステータス: ${status}`, errorData);

                            // サーバーからのエラーメッセージを表示、またはデフォルトのエラーメッセージを使用
                            throw new Error(errorData.error || `HTTPエラー! ステータス: ${status}`);
                        } else {
                            // AxiosError以外のエラー (ネットワークエラーなど)
                            console.error(`予期せぬエラー: ${error}`);
                            throw new Error(`リクエスト中に予期せぬエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
                        }
                    }
                //======================
                console.log("musicData")
                console.log(musicData)
                setArtistData(musicData["artist"])
                setTitleData(musicData["title"])
                handleProficiencyUpdate(currentUserProficiency); // 習熟度更新関数を呼ぶ
                console.log(`[Practice] musicID: ${musicId} の楽譜を取得中`); // `[Practice] Fetching scores for musicID: ${id}`
                const newXmls: string[]= [];
                // console.log(`[Practice] 習熟度 ${currentUserProficiency} のため ${musicData["sheets"][getAutoDifficulty(currentUserProficiency)]["sheet"]}.musicxmlを取得中`); // `[Practice] Fetching yoaketohotaru.musicxml for proficiency ${currentUserProficiency}`
                // let response = await fetch(`/xml/uchudekiritan${getAutoDifficulty(currentUserProficiency)}.musicxml`);
                // if (!response.ok) throw new Error(`uchudekiritan${getAutoDifficulty(currentUserProficiency)}.musicxml の取得に失敗しました`); // `Failed to fetch yoaketohotaru.musicxml` (ファイル名修正)
                // const autoxml = await response.text(); // 0番目に習熟度に合わせた楽譜
                // console.log(musicData)
                // console.log(musicData["sheets"][String(i)]["sheet"])
                const autoxml = musicData["sheets"].find(item => item.difficulty === getAutoDifficulty(currentUserProficiency))["sheet"];
                // console.log("autoxml")
                // console.log(autoxml)
                // const autoxml = musicData["sheets"][getAutoDifficulty(currentUserProficiency)]["sheet"]
                newXmls.push(autoxml); // 0番目に習熟度に合わせた楽譜
                initialize_measuredifficulty(autoxml, getAutoDifficulty(currentUserProficiency)); // 初期化関数を呼び出し
                for (let i = 1; i <= MAX_DIFFICULTY; i++) {
                    const xml = musicData["sheets"].find(item => item.difficulty === i)["sheet"];
                    newXmls.push(xml); // 1番目以降に固定難易度の楽譜
                }
                // response = await fetch(`/xml/yoaketohotaru.musicxml`); // 伴奏用XMLは未使用の可能性あり
                const acxml = musicData["sheets"].find(item => item.difficulty === Number(ACCOMPANIMENT_NUM))["sheet"];
                accompanimentXmlRef.current = acxml
                setXml(newXmls);
                // console.log(`[Practice] 伴奏用XMLの取得 ${accompanimentXmlRef.current}`); // `[Practice] Accompaniment XML fetch ${accompanimentXmlRef.current ? 'succeeded' : 'failed'}`
                console.log(`[Practice] ${newXmls.length} バージョンのXML楽譜を取得しました。`); // `[Practice] Fetched ${newXmls.length} XML score versions.`
            } catch (error) {
                console.error('[Practice] 楽譜の読み込みに失敗しました:', error);
                setXml([]);
            }
        })();
    }, [location.search]); // handleProficiencyUpdate を依存配列から削除 (無限ループの可能性)


    // ... (saveCursorPosition useCallback - 変更なし)
    const saveCursorPosition = useCallback(() => {
        if (cursorRef.current && cursorRef.current.iterator && !cursorRef.current.iterator.EndReached) {
            const iterator = cursorRef.current.iterator;
            if (iterator.currentTimeStamp) {
                cursorPositionToRestoreRef.current = {
                    measure: iterator.CurrentMeasure?.MeasureNumber ?? 1,
                    voiceEntry: iterator.currentVoiceEntryIndex,
                    part: iterator.currentPartIndex,
                    timestamp: iterator.currentTimeStamp.RealValue,
                };
                console.log("[Practice] カーソル位置を保存中:", cursorPositionToRestoreRef.current);
            } else {
                console.warn("[Practice] CurrentGeneralMusicalTime が未定義です。タイムスタンプ -1 で保存します。");
                cursorPositionToRestoreRef.current = {
                    measure: iterator.CurrentMeasure?.MeasureNumber ?? 1,
                    voiceEntry: iterator.currentVoiceEntryIndex,
                    part: iterator.currentPartIndex,
                    timestamp: -1,
                };
            }
        } else {
            cursorPositionToRestoreRef.current = null;
            console.log("[Practice] カーソルが準備できていないか、末尾にあります。位置を保存しません。");
        }
    }, []);

    // ... (restoreCursor useCallback - 変更なし)
    const restoreCursor = useCallback(() => {
        const osmd = osmdRef.current;
        const positionToRestore = cursorPositionToRestoreRef.current;
        if (osmd && osmd.cursor && positionToRestore) {
            console.log("[Practice] カーソル位置の復元を試みています:", positionToRestore);
            const currentCursor = osmd.cursor;
            currentCursor.reset();
            let found = false;
            if (positionToRestore.timestamp !== -1 && currentCursor.iterator) {
                while (!currentCursor.iterator.EndReached) {
                    if (currentCursor.iterator.currentTimeStamp &&
                        currentCursor.iterator.currentTimeStamp.RealValue >= positionToRestore.timestamp) {
                        found = true; break;
                    }
                    currentCursor.next();
                }
            }
            if (!found) {
                currentCursor.reset();
                console.warn(`[Practice] タイムスタンプでカーソルを復元できませんでした (ts: ${positionToRestore.timestamp})。リセットします。`);
            } else {
                console.log("[Practice] カーソルをおおよそ復元しました:", currentCursor.iterator?.CurrentMeasure?.MeasureNumber, currentCursor.iterator?.CurrentVoiceEntryIndex);
            }
            currentCursor.show();
            cursorRef.current = currentCursor;
        } else if (osmd && osmd.cursor) {
            console.log("[Practice] 復元する位置がないか、OSMDが完全に準備できていません。カーソルをリセットします。");
            osmd.cursor.reset();
            osmd.cursor.show();
            cursorRef.current = osmd.cursor;
        }
        cursorPositionToRestoreRef.current = null;
    }, []);
    
    // ... (メインの楽譜描画・更新 useEffect - 変更なし)
    useEffect(() => {
        if (isUpdatingXmlForProficiencyRef.current) {
            console.log("[Practice MainEffect] 習熟度によるXML更新が進行中です。再入力をスキップします。");
            return;
        }
        const currentXmlToLoad = xml[difficulty];
        if (currentXmlToLoad && osmdRef.current) {
            console.log(`[Practice MainEffect] 難易度: ${difficulty}。XML利用可能。楽譜を読み込み中。`);
            const scrollTop = saveScrollPosition();
            const difficultyActuallyChanged = prevDifficultyRef.current !== difficulty;

            if (difficultyActuallyChanged) {
                saveCursorPosition(); 
                prevDifficultyRef.current = difficulty;
                console.log(`[Practice MainEffect] 難易度が ${difficulty} に変更されました。カーソルは復元されます（可能な場合）。`); 
            } else {
                console.log("[Practice MainEffect] 難易度は変更されていません。カーソル位置は利用可能であれば復元されます。"); 
            }

            const parser = new DOMParser();
            const parsedXml = parser.parseFromString(currentXmlToLoad, 'application/xml');
            
            if (parsedXml.getElementsByTagName("parsererror").length > 0) {
                console.error("[Practice MainEffect] DOMParser found an error in the XML string:", parsedXml.getElementsByTagName("parsererror")[0].textContent);
                // OSMDに無効なXMLを渡さないようにここで処理を中断する
                return;
            }

            console.log("[Practice MainEffect] osmd.load() が呼び出されました。"); 
            osmdRef.current.load(parsedXml)
                .then(() => {
                    console.log("[Practice MainEffect] XMLが読み込まれ、osmd.render() が呼び出されました。"); 
                    osmdRef.current?.render();
                    restoreScrollPosition(scrollTop);
                    const currentOsmdCursor = osmdRef.current?.cursor;
                    if (currentOsmdCursor) {
                        cursorRef.current = currentOsmdCursor; 
                        restoreCursor(); 
                        currentOsmdCursor.show();
                        handleScrollToMeasure(currentOsmdCursor.iterator?.CurrentMeasure?.MeasureNumber ?? 1, false); 
                    } else {
                        console.warn("[Practice MainEffect] レンダリング後、OSMDカーソルが利用できません。"); 
                    }
                })
                .catch((err) => console.error('[Practice MainEffect] OSMD load/render エラー:', err));
        } else {
            console.log(`[Practice MainEffect] スキップされました。難易度 ${difficulty} のXMLまたはosmdRefが準備できていません。`); 
        }
    }, [xml, difficulty, restoreCursor, saveCursorPosition]); // handleScrollToMeasure を依存配列から削除 (useCallback化推奨)


    // ... (handleDifficultyChange useCallback - 変更なし)
    const handleDifficultyChange = useCallback((newDifficulty: Difficulty) => {
        console.log(`[Practice] 難易度を ${newDifficulty} に設定中`); 
        if (difficulty !== 0 && newDifficulty === 0) { 
             saveCursorPosition(); 
        } else if (difficulty === 0 && newDifficulty !== 0) { 
             saveCursorPosition();
        }
        setDifficulty(newDifficulty);
    }, [difficulty, saveCursorPosition]);

    // ... (getAutoDifficulty useCallback - 変更なし)
    const getAutoDifficulty = useCallback((proficiency: number): Difficulty => {
        if (!proficiency){proficiency = 0}
        return Math.min(5, Math.max(1, Math.min(MAX_DIFFICULTY, Math.floor(proficiency/2)))) as Difficulty;
    }, []);

    // ... (userProficiency 変更時の処理 useEffect - 変更なし)
    useEffect(() => {
        if (difficulty === AUTO_XML_NUM && xml.length > MAX_DIFFICULTY && xml[AUTO_XML_NUM]) {
            const currentProficiency = userProficiency;
            console.log(`[Practice ProfEffect] ユーザー習熟度: ${currentProficiency}、自動モード有効。`);

            const updateSheetForProficiency = async () => {
                if (!osmdRef.current || !osmdRef.current.Sheet || !cursorRef.current || !cursorRef.current.iterator) {
                    console.warn("[Practice ProfEffect] 習熟度更新のためのOSMD/カーソル/イテレータが準備できていません。");
                    return;
                }

                isUpdatingXmlForProficiencyRef.current = true;
                console.log(`[Practice ProfEffect] isUpdatingXmlForProficiencyRef set to true.`);

                let actualChangesMade = false;
                let anyReplaceFailed = false; 

                try {
                    saveCursorPosition(); 

                    const iterator = cursorRef.current.iterator;
                    let currentSequentialMeasureIndex: number; 

                    if (iterator.EndReached) {
                        const measuresInSheet = osmdRef.current.Sheet.SourceMeasures;
                        let totalMeasures = 0;
                        measuresInSheet.forEach(partMeasures => totalMeasures += partMeasures.length); // 全パートの小節数を合計（単純化のため最初のパートのみ考慮も可）
                        currentSequentialMeasureIndex = totalMeasures > 0 ? totalMeasures -1 : 0; 
                        console.log(`[Practice ProfEffect] カーソルが末尾です。更新開始小節の計算に最後の小節 (${currentSequentialMeasureIndex + 1}番目) を基準とします。`);
                    } else {
                        const currentMeasureNumber = iterator.CurrentMeasure?.MeasureNumber ?? 1;
                        console.log(`[Practice ProfEffect] 現在のカーソル小節番号: ${currentMeasureNumber}`);
                        const tempParser = new DOMParser();
                        const tempXmlDoc = tempParser.parseFromString(xml[AUTO_XML_NUM], "application/xml");
                        const allMeasuresInAutoXml = Array.from(tempXmlDoc.querySelectorAll("measure"));
                        let foundCurrentMeasureIndex = -1;
                        for(let i = 0; i < allMeasuresInAutoXml.length; i++) {
                            if (allMeasuresInAutoXml[i].getAttribute("number") === currentMeasureNumber.toString()) {
                                foundCurrentMeasureIndex = i;
                                break;
                            }
                        }
                        currentSequentialMeasureIndex = foundCurrentMeasureIndex !== -1 ? foundCurrentMeasureIndex : 0;
                    }

                    const autoDiff = getAutoDifficulty(currentProficiency);
                    const baseXmlToUpdate = xml[AUTO_XML_NUM];
                    const newDifficultyXml = xml[autoDiff]; 

                    if (!newDifficultyXml) {
                        console.warn(`[Practice ProfEffect] 目標の自動難易度 ${autoDiff} のXML が見つかりません。`);
                        isUpdatingXmlForProficiencyRef.current = false; // 早期リターン時はフラグを戻す
                        return; 
                    }

                    const targetStartSequentialIndex = currentSequentialMeasureIndex + 2;

                    const parser = new DOMParser(); 
                    const xmlDocForLookup = parser.parseFromString(baseXmlToUpdate, "application/xml");

                    if (xmlDocForLookup.getElementsByTagName("parsererror").length > 0) {
                        console.error('[Practice ProfEffect] Failed to parse baseXmlToUpdate for locating start measure.');
                        anyReplaceFailed = true;
                    }

                    let startMeasureAttribute: string | null = null;
                    if (!anyReplaceFailed) {
                        const measuresInBase = Array.from(xmlDocForLookup.querySelectorAll("measure"));
                        if (targetStartSequentialIndex < measuresInBase.length && targetStartSequentialIndex >= 0) {
                            const targetMeasureElement = measuresInBase[targetStartSequentialIndex];
                            startMeasureAttribute = targetMeasureElement.getAttribute("number");
                        }
                    }

                    if (startMeasureAttribute) {
                        console.log(`[Practice ProfEffect] 習熟度 ${currentProficiency} (自動難易度 ${autoDiff}) のため、小節 number="${startMeasureAttribute}" から一括更新します。`);
                        const updatedXml = await replaceMeasuresFrom(baseXmlToUpdate, newDifficultyXml, startMeasureAttribute);

                        if (updatedXml) {
                            if (updatedXml !== baseXmlToUpdate) { 
                                actualChangesMade = true;
                                console.log("[Practice ProfEffect] XMLが一括変更されました。setXmlを呼び出します。");
                                // handlemeasureDifficultyFrom の呼び出し位置と引数を再確認
                                // Number(startMeasureAttribute) が正しい measure number を指すか注意
                                const startMeasureNumForDifficultyUpdate = parseInt(startMeasureAttribute, 10);
                                if (!isNaN(startMeasureNumForDifficultyUpdate)) {
                                    handlemeasureDifficultyFrom(startMeasureNumForDifficultyUpdate, autoDiff); 
                                } else {
                                    console.warn(`[Practice ProfEffect] Invalid startMeasureAttribute for difficulty update: ${startMeasureAttribute}`);
                                }

                                setXml(prevXml => {
                                    const newXmlArray = [...prevXml];
                                    newXmlArray[AUTO_XML_NUM] = updatedXml;
                                    return newXmlArray;
                                });
                            } else {
                                console.log("[Practice ProfEffect] replaceMeasuresFrom が実行されましたが、XMLへの実際の変更はありませんでした。");
                            }
                        } else { 
                            console.warn(`[Practice ProfEffect] replaceMeasuresFrom が null を返しました。XML更新に失敗。`);
                            anyReplaceFailed = true;
                        }
                    } else if (!anyReplaceFailed) {
                        console.log(`[Practice ProfEffect] 更新開始対象の小節 (計算上のインデックス: ${targetStartSequentialIndex}) が見つからないか、number属性がありませんでした。楽譜の終端に近い可能性があります。`);
                    }
                } catch (error) {
                     console.error("[Practice ProfEffect] 習熟度に応じたXML更新処理中に予期せぬエラーが発生しました:", error);
                     anyReplaceFailed = true; 
                } finally {
                     isUpdatingXmlForProficiencyRef.current = false;
                     console.log(`[Practice ProfEffect] isUpdatingXmlForProficiencyRef set to false (finally block). ActualChanges: ${actualChangesMade}, AnyReplaceFailed: ${anyReplaceFailed}`);
                }
            };

            updateSheetForProficiency();

        } else if (difficulty === AUTO_XML_NUM) {
            console.log(`[Practice ProfEffect] 自動モード (${difficulty}) ですが、XML配列が不十分 (length: ${xml.length}, MAX_DIFFICULTY: ${MAX_DIFFICULTY})、または xml[${AUTO_XML_NUM}] が未定義です。処理をスキップします。`);
        }
    }, [userProficiency, difficulty, xml, getAutoDifficulty, saveCursorPosition, AUTO_XML_NUM, MAX_DIFFICULTY]); // xml, MAX_DIFFICULTY を追加
    
    // ... (initialize_measuredifficulty useCallback - 変更なし)
    const initialize_measuredifficulty = useCallback((currentXml:string,diff: Difficulty) => { 
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(currentXml, 'application/xml');
        const measures = Array.from(xmlDoc.querySelectorAll('measure'));
        measureDifficultiesRef.current = Array(measures.length).fill(diff) 
    }, []);

    // ... (handlemeasureDifficultyFrom useCallback - 変更なし)
    const handlemeasureDifficultyFrom = useCallback((startMeasureNum: number, diff: Difficulty) => { 
        if (startMeasureNum -1 >= 0 && startMeasureNum -1 < measureDifficultiesRef.current.length ) {
             measureDifficultiesRef.current = measureDifficultiesRef.current.fill(diff, startMeasureNum - 1);
        } else {
            console.warn(`[Practice] handlemeasureDifficultyFrom: 無効な開始小節番号 ${startMeasureNum}`);
        }
    }, []);

    // ... (handleProficiencyUpdate useCallback - 変更なし)
    const handleProficiencyUpdate = useCallback((newProficiency: number) => {
        console.log(`[Practice] handleProficiencyUpdate が呼び出されました。新しい習熟度: ${newProficiency}`);
        setUserProficiency(newProficiency);
    }, []);

    // ... (handleScrollToMeasure - 変更なし、ただしセレクタ部分は注意が必要)
    const handleScrollToMeasure = (measureNumber: number, smooth :boolean = false) =>     {
        const container = scrollContainerRef.current;
        const div = mainDivRef.current;
        if (!container || !div) {
            console.error("[DEBUG] Container or div ref is not available.");
            return;
        }
        let svgMeasure: Element | null = null;
        // OSMDが生成するSVG小節要素は、通常 measureNumber 属性を持たないため、
        // OSMDの内部データ構造や、表示されるSVG要素のIDパターン（例：PartIndex-MeasureIndex）に
        // 基づいて特定する必要があるかもしれません。
        // ここでは、仮に measureNumber を持つg.vf-measureを探しますが、これは一般的ではありません。
        // より堅牢な方法は、OSMDのAPIを通じて特定の小節のSVG要素を取得することです。
        const allSvgMeasures = Array.from(div.querySelectorAll('g.vf-measure')); // Generic selector
        // Find measure by iterating and checking OSMD's internal numbering if possible, or by sequential index
        // For simplicity, if measureNumber is 1, take the first, otherwise this needs more logic.
        if (measureNumber > 0 && measureNumber <= allSvgMeasures.length) {
            svgMeasure = allSvgMeasures[measureNumber - 1]; // 0-indexed access
        }

        if (!svgMeasure) {
            console.warn(`[DEBUG] SVG Measure corresponding to ${measureNumber} not found or logic needs refinement.`);
            return;
        }

        let referenceTopY: number;
        const lineGroup = svgMeasure.closest('g.staffline, g.vf-stave, g.vf-system');
        if (lineGroup) {
            referenceTopY = lineGroup.getBoundingClientRect().top;
        } else {
            console.warn(`[DEBUG] Line group not found for measure ${measureNumber}. Using the measure itself as reference.`);
            referenceTopY = svgMeasure.getBoundingClientRect().top;
        }
        const containerRect = container.getBoundingClientRect();
        const desiredVisualMarginPx = 20; 
        const logicalOffsetOfLineFromContainerTop = (referenceTopY - containerRect.top) / ZOOM_RATE;
        const absoluteLogicalOffsetOfLine = container.scrollTop + logicalOffsetOfLineFromContainerTop;
        const logicalMargin = desiredVisualMarginPx / ZOOM_RATE;
        let targetScrollTop = absoluteLogicalOffsetOfLine - logicalMargin;
        targetScrollTop = Math.max(0, targetScrollTop);
        
        if (smooth) {
            const scrollDuration = 300; // ms
            const startTime = performance.now();
            const startScrollTop = container.scrollTop;

            const scrollAnimation = (currentTime: number) => {
                const elapsedTime = currentTime - startTime;
                const progress = Math.min(elapsedTime / scrollDuration, 1);
                container.scrollTop = startScrollTop + (targetScrollTop - startScrollTop) * progress; // Simple linear interpolation
                if (progress < 1) {
                    requestAnimationFrame(scrollAnimation);
                }
            };
            requestAnimationFrame(scrollAnimation);
        } else {
            container.scrollTo({
                top: targetScrollTop,
            });
        }
    };

    // ... (getMeasureDifficulty useCallback - 変更なし)
    const getMeasureDifficulty = useCallback((measureNumber: number, nowdifficulty: Difficulty =difficulty): Difficulty => {
        if (nowdifficulty === AUTO_XML_NUM) {
            if (measureNumber >= 1 && measureNumber <= measureDifficultiesRef.current.length) {
                return measureDifficultiesRef.current[measureNumber - 1] as Difficulty;
            }
            console.warn(`[Practice] getMeasureDifficulty: 小節番号 ${measureNumber} は範囲外です。`);
            return 0; 
        } else if (nowdifficulty > 0 && nowdifficulty <= MAX_DIFFICULTY) {
            return nowdifficulty;
        }
        console.warn(`[Practice] getMeasureDifficulty: 無効な全体難易度 ${nowdifficulty} が指定されました。`);
        return 0; 
    }, [difficulty, AUTO_XML_NUM, MAX_DIFFICULTY]);

    const handleAddToFavorites = useCallback(async () => {
        if (!currentMusicID) {
            console.warn("No musicID available to add to favorites.");
            alert("楽曲IDが取得できていないため、お気に入りに追加できません。");
            return;
        }
        try {
            const musicIdNumber = parseInt(currentMusicID, 10);
            if (isNaN(musicIdNumber)) {
                console.error("Invalid MusicID format:", currentMusicID);
                alert("楽曲IDの形式が正しくありません。");
                return;
            }

            console.log(`[Practice] Adding Music ID ${musicIdNumber} to favorites...`);
            const response = await fetch(`http://localhost:8080/favorites`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ music_id: musicIdNumber }), // API仕様に合わせて送信
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Add Favorite API request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }
            console.log(`Music ID ${musicIdNumber} successfully added to favorites.`);
            alert(`「${titleData}」をお気に入りに追加しました！`);
            // ここでボタンの見た目を変える（例：塗りつぶしハートにする）などの処理も可能
        } catch (error) {
            console.error("Failed to add to favorites:", error);
            alert(`お気に入りへの追加に失敗しました。\n${error instanceof Error ? error.message : '不明なエラー'}`);
        }
    }, [currentMusicID, titleData]); // titleDataも依存配列に追加（アラートメッセージ用）

    // --- スタイル定義 ---
    const viewScoreContainerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden', // 全体のスクロールバーを隠す
    };

    const headerStyle: React.CSSProperties = {
        backgroundColor: '#D6E0EA', // 画像に近い薄い青色 (フッターより薄く)
        padding: '12px 20px', // 少しパディング調整
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        borderBottom: '1px solid #BCCCDC', // 少し濃いめの区切り線
    };

    const backButtonStyle: React.CSSProperties = {
        background: 'none',
        border: 'none',
        color: '#334155', // より濃い青系またはグレー
        cursor: 'pointer',
        fontSize: '1.8rem', // アイコンサイズ
        padding: '0', // パディングをリセット
        marginRight: '15px', // タイトルとの間にスペース
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1, // アイコンの垂直位置調整用
    };

    const titleContainerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        flexGrow: 1,
        textAlign: 'left',
    };

    const songTitleStyle: React.CSSProperties = {
        fontSize: '1.1rem', // 少し調整
        fontWeight: '600',  // 少し太く (boldよりは細い場合も)
        color: '#1E293B', // 濃いグレー、ほぼ黒
        margin: 0,
        lineHeight: 1.3,
    };

    const artistNameStyle: React.CSSProperties = {
        fontSize: '0.8rem', // 少し小さく
        color: '#475569',   // ミディアムグレー
        margin: 0,
        lineHeight: 1.3,
    };

    const mainContentStyle: React.CSSProperties = {
        flexGrow: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: '#FFFFFF', // 背景を白に
        width: `${100 / ZOOM_RATE}vw`,
        zoom: `${ZOOM_RATE}`
        // padding: '1rem', // OSMDコンテナのpadding/marginで調整するため削除も検討
    };

    const osmdWrapperStyle: React.CSSProperties = { // OSMDコンテナをラップしてpadding/marginを制御
        padding: '1rem', // ここで楽譜周囲の余白を確保

    }
        // ★ ハートボタン用のスタイル
    const favoriteButtonStyle: React.CSSProperties = {
        background: 'none',
        border: 'none',
        color: '#FF6B6B', // ハートの色 (例: 赤系)
        cursor: 'pointer',
        fontSize: '1.6rem', // アイコンサイズ
        padding: '5px',
        marginLeft: 'auto', // これで右端に寄せる
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };
    const favoriteButtonDisabledStyle: React.CSSProperties = {
        ...favoriteButtonStyle,
        color: '#CCCCCC', // 無効時の色
        cursor: 'not-allowed',
    };

    const osmdContainerStyle: React.CSSProperties = {
        width: `calc(100% / ${ZOOM_RATE})`, // 親要素の幅基準に変更
        transform: `scale(${ZOOM_RATE})`,
        transformOrigin: 'top left',
        backgroundColor: '#FFFFFF', // OSMDの背景も白を明示
        // minHeight: '100%', // 必要に応じて
    };

    const footerWrapperStyle: React.CSSProperties = {
        flexShrink: 0,
        // position, bottom, left, zIndex は OSMDPlayer 内部の footerStyle で管理
    };

    return (
        <div style={viewScoreContainerStyle}>
            <header style={headerStyle}>
                <button 
                    onClick={() => navigate('/home')} // ★ 変更点: '/home' にナビゲート
                    style={backButtonStyle} 
                    title="ホームに戻る" // title属性も変更
                >
                    {'<'}
                </button>
                <div style={titleContainerStyle}>
                    <h1 style={songTitleStyle}>{titleData}</h1>
                    <p style={artistNameStyle}>{artistData}</p>
                </div>
                {/* LinkButton は画像のデザインにはないため、一旦削除。必要であれば別の場所に配置 */}
                {/* <LinkButton text="ホーム画面" link="/home" /> */}
                <button
                    onClick={handleAddToFavorites}
                    style={favoriteButtonStyle}
                    title="お気に入りに追加"
                    disabled={!currentMusicID}
                >
                    <IoHeartSharp />
                </button>
            </header>

            <main ref={scrollContainerRef} style={mainContentStyle}>
                <div style={osmdWrapperStyle}> {/* OSMDの周囲に余白を持たせるラッパー */}
                    <div ref={mainDivRef} style={osmdContainerStyle} />

                </div>
                {/* スペーサーdivはOSMDの描画によっては不要な場合がある。OSMDが自身の高さを正しく計算すれば、
                    mainContentStyleのflexGrow:1で適切に伸縮するはず。 */}
                {/* <div style={{ height: '50vh' }} /> */}
            </main>

            <div style={footerWrapperStyle}> {/* OSMDPlayerのフッターが固定されるように */}
                {osmdRef.current && (
                    <OSMDPlayer
                        osmd={osmdRef}
                        difficulty={difficulty}
                        accompanimentXml={accompanimentXmlRef.current}
                        basebpm={musicbpmRef.current}
                        onDifficultyChange={handleDifficultyChange}
                        onProficiencyUpdate={handleProficiencyUpdate}
                        getMeasureDifficulty={getMeasureDifficulty}
                        onRequestScrollToMeasure={handleScrollToMeasure}
                    />
                )}
            </div>
        </div>
    );
}