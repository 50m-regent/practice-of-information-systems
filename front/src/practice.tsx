import { LinkButton } from "./components/test/link";
import { useRef, useEffect, useState, useCallback, use } from 'react';
import { useLocation } from "react-router-dom";
import { OpenSheetMusicDisplay, Cursor } from 'opensheetmusicdisplay';
import { OSMDPlayer } from './components/OSMDPlayer';
import { Difficulty } from './types/types';
import axios from 'axios'; // 未使用の可能性あり

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
        // console.log(`[replaceMeasure] ${measureB}`); // `[replaceMeasure] Attempting to replace measure ${measureNumber}...`
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
/**
 * musicXmlA の指定された開始小節以降のすべての小節を、
 * musicXmlB の対応する number 属性を持つ小節の内容で置き換えます。
 *
 * @param musicXmlA ベースとなる楽譜のXML文字列 (更新対象)
 * @param musicXmlB 置換に使用する小節群を含む楽譜のXML文字列 (参照元)
 * @param startMeasureNumberAttribute 置換を開始する小節の number 属性値 (例: "1", "1a", "Pickup")
 * @returns 更新された楽譜のXML文字列。エラーが発生した場合は null。
 */
// (Practice.tsx のコンポーネント定義より前、またはインポート)
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

        // XMLパースエラーのチェック
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
    const title: string = "楽譜表示画面";
    // 定数
    const ZOOM_RATE = 0.8; // 画面のズーム率
    const MAX_DIFFICULTY: Difficulty = 5; // 最大難易度
    const ACCOMPANIMENT_NUM = "-1"; // 未使用の可能性あり
    const AUTO_XML_NUM = 0; // 自動XMLのインデックス、未使用の可能性あり
    // 変数
    const location = useLocation();
    const mainDivRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const cursorRef = useRef<Cursor | null>(null);

    const [difficulty, setDifficulty] = useState<Difficulty>(0);
    const [userProficiency, setUserProficiency] = useState<number>(1);
    const [xml, setXml] = useState<string[]>([]);
    
    const measureDifficultiesRef = useRef<Difficulty[]>([]);
    const musicbpmRef = useRef<number>(120); // 音楽のBPM、未使用の可能性あり
    const prevDifficultyRef = useRef<Difficulty>(difficulty);
    const cursorPositionToRestoreRef = useRef<CursorPosition | null>(null);
    const isUpdatingXmlForProficiencyRef = useRef<boolean>(false); // 名前をより具体的に
    const accompanimentXmlRef = useRef<string | null>(null); // 伴奏用XMLの参照、未使用の可能性あり

    const saveScrollPosition = () => {return scrollContainerRef.current ? scrollContainerRef.current.scrollTop : 0};
    const restoreScrollPosition = (scrollTop: number) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollTop;
        }
    };

    // OSMDインスタンスの初期化
    useEffect(() => {
        if (mainDivRef.current && !osmdRef.current) {
            const instance = new OpenSheetMusicDisplay(mainDivRef.current, {
                backend: "svg", drawTitle: true, autoResize: true,
            });
            osmdRef.current = instance;
            cursorRef.current = instance.cursor; // ここで初期カーソルをセット
            console.log("[Practice] OSMDが初期化され、カーソルrefが設定されました。"); // "[Practice] OSMD initialized and cursor ref set."
        }
    }, []);

    // 楽譜の読み込み (URLのmusicIDまたは難易度に基づいて)
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const id = queryParams.get("musicID");
        if (!id) {
            console.warn("[Practice] URLにmusicIDが見つかりません。"); // "[Practice] musicID not found in URL."
            setXml([]); return;
        }

        (async () => {
            try {
                // console.log(`[Practice InitEffect] ユーザーの初期習熟度をAxios経由で取得中 (musicID: ${id})...`);
                const randomdata = await (async () => {return Math.floor(Math.random() * 4) + 2})(); // 1から5のランダムな難易度を生成
                console.log(`[Practice InitEffect] ランダムな習熟度データが生成されました: ${randomdata}`); // `[Practice InitEffect] Random proficiency data generated: ${randomdata}`
                const responseProf = { data: {userProficiency: randomdata} }; // 仮のデータ
                // const response = await axios.get("http://localhost:8080/getUserProficiency");
                const currentUserProficiency = responseProf.data.userProficiency;
                handleProficiencyUpdate(currentUserProficiency); // 習熟度更新関数を呼ぶ
                console.log(`[Practice] musicID: ${id} の楽譜を取得中`); // `[Practice] Fetching scores for musicID: ${id}`
                const newXmls: string[]= [];
                console.log(`[Practice] 習熟度 ${currentUserProficiency} のため uchudekiritan${getAutoDifficulty(currentUserProficiency)}.musicxmlを取得中`); // `[Practice] Fetching yoaketohotaru.musicxml for proficiency ${currentUserProficiency}`
                let response = await fetch(`/xml/uchudekiritan${getAutoDifficulty(currentUserProficiency)}.musicxml`);
                if (!response.ok) throw new Error(`uchudekiritan${getAutoDifficulty(currentUserProficiency)}.musicxml の取得に失敗しました`); // `Failed to fetch yoaketohotaru.musicxml` (ファイル名修正)
                const autoxml = await response.text(); // 0番目に習熟度に合わせた楽譜
                newXmls.push(autoxml); // 0番目に習熟度に合わせた楽譜
                initialize_measuredifficulty(autoxml, getAutoDifficulty(currentUserProficiency)); // 初期化関数を呼び出し
                for (let i = 1; i <= MAX_DIFFICULTY; i++) {
                    response = await fetch(`/xml/uchudekiritan${i}.musicxml`);
                    if (!response.ok) throw new Error(`uchudekiritan${i}.musicxml の取得に失敗しました`); // `Failed to fetch uchudekiritan${i}.musicxml`
                    newXmls.push(await response.text()); // 1番目以降に固定難易度の楽譜
                }
                setXml(newXmls);
                response = await fetch(`/xml/uchudekiritan${ACCOMPANIMENT_NUM}.musicxml`); // 伴奏用XMLは未使用の可能性あり
                accompanimentXmlRef.current = response.ok ? await response.text() : null; // 伴奏用XMLの取得
                console.log(`[Practice] ${newXmls.length} バージョンのXML楽譜を取得しました。`); // `[Practice] Fetched ${newXmls.length} XML score versions.`
            } catch (error) {
                console.error('[Practice] 楽譜の読み込みに失敗しました:', error);
                setXml([]);
            }
        })();
    }, [location.search]); // handleProficiencyUpdate を依存配列から削除 (無限ループの可能性)

    const saveCursorPosition = useCallback(() => {
        if (cursorRef.current && cursorRef.current.iterator && !cursorRef.current.iterator.EndReached) {
            const iterator = cursorRef.current.iterator;
            console.log("[Practice] イテレータ中身："); // "[Practice] Saving cursor position..."
            console.log(iterator); // "[Practice] Saving cursor position...
            if (iterator.currentTimeStamp) {
                cursorPositionToRestoreRef.current = {
                    measure: iterator.CurrentMeasure?.MeasureNumber ?? 1,
                    voiceEntry: iterator.currentVoiceEntryIndex,
                    part: iterator.currentPartIndex,
                    timestamp: iterator.currentTimeStamp.RealValue,
                };
                console.log("[Practice] カーソル位置を保存中:", cursorPositionToRestoreRef.current); // "[Practice] Saving cursor position:", cursorPositionToRestoreRef.current
            } else {
                console.warn("[Practice] CurrentGeneralMusicalTime が未定義です。タイムスタンプ -1 で保存します。"); // "[Practice] CurrentGeneralMusicalTime is undefined. Saving with timestamp -1."
                cursorPositionToRestoreRef.current = {
                    measure: iterator.CurrentMeasure?.MeasureNumber ?? 1,
                    voiceEntry: iterator.currentVoiceEntryIndex,
                    part: iterator.currentPartIndex,
                    timestamp: -1,
                };
            }
        } else {
            cursorPositionToRestoreRef.current = null;
            console.log("[Practice] カーソルが準備できていないか、末尾にあります。位置を保存しません。"); // "[Practice] Cursor not ready or at end. Not saving position."
        }
    }, []);

    const restoreCursor = useCallback(() => {
        const osmd = osmdRef.current;
        const positionToRestore = cursorPositionToRestoreRef.current;
        if (osmd && osmd.cursor && positionToRestore) { // osmd.cursor も確認
            console.log("[Practice] カーソル位置の復元を試みています:", positionToRestore); // "[Practice] Attempting to restore cursor position to:", positionToRestore
            const currentCursor = osmd.cursor;
            currentCursor.reset();
            let found = false;
            if (positionToRestore.timestamp !== -1 && currentCursor.iterator) { // iterator も確認
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
                console.warn(`[Practice] タイムスタンプでカーソルを復元できませんでした (ts: ${positionToRestore.timestamp})。リセットします。`); // `[Practice] Could not restore cursor by timestamp (ts: ${positionToRestore.timestamp}). Resetting.`
            } else {
                console.log("[Practice] カーソルをおおよそ復元しました:", currentCursor.iterator?.CurrentMeasure?.MeasureNumber, currentCursor.iterator?.CurrentVoiceEntryIndex); // "[Practice] Restored cursor to approx.:", currentCursor.iterator?.CurrentMeasure?.MeasureNumber, currentCursor.iterator?.CurrentVoiceEntryIndex
            }
            currentCursor.show();
            cursorRef.current = currentCursor; // cursorRefも更新
        } else if (osmd && osmd.cursor) {
            console.log("[Practice] 復元する位置がないか、OSMDが完全に準備できていません。カーソルをリセットします。"); // "[Practice] No position to restore or OSMD not fully ready, resetting cursor."
            osmd.cursor.reset();
            osmd.cursor.show();
            cursorRef.current = osmd.cursor; // cursorRefも更新
        }
        cursorPositionToRestoreRef.current = null; // 復元試行後はクリア
    }, []);

    // メインの楽譜描画・更新 useEffect
    useEffect(() => {
        if (isUpdatingXmlForProficiencyRef.current) {
            console.log("[Practice MainEffect] 習熟度によるXML更新が進行中です。再入力をスキップします。"); // "[Practice MainEffect] XML update for proficiency in progress, skipping re-entry."
            return;
        }
        const currentXmlToLoad = xml[difficulty];
        if (currentXmlToLoad && osmdRef.current) {
            console.log(`[Practice MainEffect] 難易度: ${difficulty}。XML利用可能。楽譜を読み込み中。`); // `[Practice MainEffect] Difficulty: ${difficulty}. XML available. Loading score.`
            const scrollTop = saveScrollPosition();
            const difficultyActuallyChanged = prevDifficultyRef.current !== difficulty;

            if (difficultyActuallyChanged) {
                saveCursorPosition(); // 難易度変更前にカーソル位置を保存
                prevDifficultyRef.current = difficulty;
                console.log(`[Practice MainEffect] 難易度が ${difficulty} に変更されました。カーソルは復元されます（可能な場合）。`); // `[Practice MainEffect] Difficulty changed to: ${difficulty}. Cursor will be reset.` (メッセージ変更)
            } else {
                console.log("[Practice MainEffect] 難易度は変更されていません。カーソル位置は利用可能であれば復元されます。"); // "[Practice MainEffect] Difficulty unchanged. Cursor position will be restored if available."
            }

            const parser = new DOMParser();
            const parsedXml = parser.parseFromString(currentXmlToLoad, 'application/xml');

            console.log("[Practice MainEffect] osmd.load() が呼び出されました。"); // "[Practice MainEffect] osmd.load() called."
            osmdRef.current.load(parsedXml)
                .then(() => {
                    console.log("[Practice MainEffect] XMLが読み込まれ、osmd.render() が呼び出されました。"); // "[Practice MainEffect] XML loaded, osmd.render() called."
                    osmdRef.current?.render();
                    restoreScrollPosition(scrollTop);
                    const currentOsmdCursor = osmdRef.current?.cursor;
                    if (currentOsmdCursor) {
                        cursorRef.current = currentOsmdCursor; // 最新のカーソルでrefを更新
                        // 難易度が実際に変更されたか、または復元するカーソル位置がない場合はリセット
                        if (difficultyActuallyChanged || !cursorPositionToRestoreRef.current) {
                           // currentOsmdCursor.reset(); // restoreCursorに任せる
                           // console.log("[Practice MainEffect] Cursor has been reset due to difficulty change or no saved position.");
                        }
                        restoreCursor(); // 常にrestoreCursorを呼ぶ（リセットロジックも含む）
                        currentOsmdCursor.show();
                        handleScrollToMeasure(currentOsmdCursor.iterator?.CurrentMeasure?.MeasureNumber ?? 1, false); // カーソルの小節にスクロール
                    } else {
                        console.warn("[Practice MainEffect] レンダリング後、OSMDカーソルが利用できません。"); // "[Practice MainEffect] OSMD cursor not available after render."
                    }
                })
                .catch((err) => console.error('[Practice MainEffect] OSMD load/render エラー:', err));
        } else {
            console.log(`[Practice MainEffect] スキップされました。難易度 ${difficulty} のXMLまたはosmdRefが準備できていません。`); // `[Practice MainEffect] Skipped. XML for difficulty ${difficulty} or osmdRef not ready.`
        }
    }, [xml, difficulty, restoreCursor, saveCursorPosition]); // 依存配列に restoreCursor と saveCursorPosition を追加


    const handleDifficultyChange = useCallback((newDifficulty: Difficulty) => {
        console.log(`[Practice] 難易度を ${newDifficulty} に設定中`); // `[Practice] Setting difficulty to: ${newDifficulty}`
        if (difficulty !== 0 && newDifficulty === 0) { // 難易度付きからautoへの変更時
             saveCursorPosition(); // カーソル位置を保存
        } else if (difficulty === 0 && newDifficulty !== 0) { // autoから難易度付きへの変更時
             saveCursorPosition();
        }
        setDifficulty(newDifficulty);
    }, [difficulty, saveCursorPosition]); // difficulty と saveCursorPosition を依存配列に追加

    const getAutoDifficulty = useCallback((proficiency: number) => {
        return Math.max(1, Math.min(MAX_DIFFICULTY, Math.floor(proficiency/2))) as Difficulty; // MAX_DIFFICULTYを使用
    }, []); // MAX_DIFFICULTY はスコープ内で定数なので依存配列に不要

    // userProficiency 変更時の処理 useEffect
    useEffect(() => {
        // 自動モード (difficulty === 0) で、かつ必要なXMLデータが揃っている場合のみ実行
        // xml[0] (AUTO_XML_NUM) と xml[1]からxml[MAX_DIFFICULTY]までが存在することを期待
        if (difficulty === AUTO_XML_NUM && xml.length > MAX_DIFFICULTY && xml[AUTO_XML_NUM]) {
            const currentProficiency = userProficiency;
            console.log(`[Practice ProfEffect] ユーザー習熟度: ${currentProficiency}、自動モード有効。`);

            const updateSheetForProficiency = async () => {
                if (!osmdRef.current || !cursorRef.current || !cursorRef.current.iterator) {
                    console.warn("[Practice ProfEffect] 習熟度更新のためのOSMD/カーソル/イテレータが準備できていません。");
                    return;
                }

                isUpdatingXmlForProficiencyRef.current = true;
                console.log(`[Practice ProfEffect] isUpdatingXmlForProficiencyRef set to true.`);

                let actualChangesMade = false;
                let anyReplaceFailed = false; // このフラグは replaceMeasuresFrom がnullを返した場合などに使用

                try {
                    saveCursorPosition(); // 現状のカーソル位置を保存

                    const iterator = cursorRef.current.iterator;
                    let currentSequentialMeasureIndex: number; // カーソルのある小節が、楽譜全体の何番目の小節か (0-indexed)

                    if (iterator.EndReached) {
                        // カーソルが末尾の場合、最終小節の次のインデックスとするか、
                        // または楽譜の長さを超えないように調整
                        const measuresCount = osmdRef.current.Sheet?.SourceMeasures?.length ?? 0;
                        currentSequentialMeasureIndex = measuresCount > 0 ? measuresCount -1 : 0; // 最後の小節のインデックス
                        console.log(`[Practice ProfEffect] カーソルが末尾です。更新開始小節の計算に最後の小節 (${currentSequentialMeasureIndex + 1}番目) を基準とします。`);
                    } else {
                        // 現在のカーソル位置の小節インデックスを取得
                        // iterator.CurrentMeasureIndex は現在の part の中での measure index なので、
                        // 全体での通し番号が必要な場合は注意。
                        // ここでは、iterator.CurrentMeasure.MeasureNumber を基準にするのがより直接的。
                        const currentMeasureNumber = iterator.CurrentMeasure?.MeasureNumber ?? 1;
                        // このMeasureNumberが何番目の要素かは、一度パースして数える必要があるかもしれない。
                        // 簡単のため、現在のカーソル位置の小節の「次の次」から更新すると仮定。
                        // その「次の次」の小節の number 属性を見つける必要がある。
                        console.log(`[Practice ProfEffect] 現在のカーソル小節番号: ${currentMeasureNumber}`);
                        // このcurrentMeasureNumberを基準に、XML DOMから実際のインデックスを探すか、
                        // もしくは、OSMDのAPIでより直接的にシーケンシャルなインデックスを取得できればそれを使う。
                        // OSMDの SourceMeasures は Part ごとの配列の配列なので、単純ではない。
                        // ここでは、現在のカーソルの MeasureNumber を持つ要素のインデックスを探索する。
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
                    const newDifficultyXml = xml[autoDiff]; // 参照用（コピー元）の難易度別楽譜

                    if (!newDifficultyXml) {
                        console.warn(`[Practice ProfEffect] 目標の自動難易度 ${autoDiff} のXML (${`uchudekiritan${autoDiff}.musicxml`}) が見つかりません。`);
                        // finally でフラグが戻るので、ここでは早期リターン時のフラグ操作は不要
                        // ただし、isUpdatingXmlForProficiencyRef はこの非同期関数の最後にfalseになるので、
                        // ここでreturnする場合、finallyは実行される。
                        return; // finally が実行される
                    }

                    // 更新を開始する小節のインデックス (0-indexed) を決定 (現在の2つ先)
                    const targetStartSequentialIndex = currentSequentialMeasureIndex + 2;

                    const parser = new DOMParser(); // startMeasureAttribute特定のためにパース
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
                            if (updatedXml !== baseXmlToUpdate) { // 文字列として実際に変更があったか
                                actualChangesMade = true;
                                console.log("[Practice ProfEffect] XMLが一括変更されました。setXmlを呼び出します。");
                                handlemeasureDifficultyFrom(Number(startMeasureAttribute), autoDiff); // 小節の難易度を更新
                                setXml(prevXml => {
                                    const newXmlArray = [...prevXml];
                                    newXmlArray[AUTO_XML_NUM] = updatedXml;
                                    return newXmlArray;
                                });
                            } else {
                                console.log("[Practice ProfEffect] replaceMeasuresFrom が実行されましたが、XMLへの実際の変更はありませんでした。");
                            }
                        } else { // replaceMeasuresFrom が null を返した場合
                            console.warn(`[Practice ProfEffect] replaceMeasuresFrom が null を返しました。XML更新に失敗。`);
                            anyReplaceFailed = true;
                        }
                    } else if (!anyReplaceFailed) {
                        console.log(`[Practice ProfEffect] 更新開始対象の小節 (計算上のインデックス: ${targetStartSequentialIndex}) が見つからないか、number属性がありませんでした。楽譜の終端に近い可能性があります。`);
                        // actualChangesMade は false のまま
                    }
                } catch (error) {
                     console.error("[Practice ProfEffect] 習熟度に応じたXML更新処理中に予期せぬエラーが発生しました:", error);
                     anyReplaceFailed = true; // catchした場合も失敗とみなす
                } finally {
                     isUpdatingXmlForProficiencyRef.current = false;
                     console.log(`[Practice ProfEffect] isUpdatingXmlForProficiencyRef set to false (finally block). ActualChanges: ${actualChangesMade}, AnyReplaceFailed: ${anyReplaceFailed}`);
                }
            };

            updateSheetForProficiency();

        } else if (difficulty === AUTO_XML_NUM) {
            // 自動モードだが、XML配列が不十分などの理由で処理をスキップする場合のログ
            console.log(`[Practice ProfEffect] 自動モード (${difficulty}) ですが、XML配列が不十分 (length: ${xml.length}, MAX_DIFFICULTY: ${MAX_DIFFICULTY})、または xml[${AUTO_XML_NUM}] が未定義です。処理をスキップします。`);
        }
    // 依存配列から xml と MAX_DIFFICULTY を削除 (MAX_DIFFICULTY はコンポーネントスコープの定数)
    }, [userProficiency, difficulty, saveCursorPosition, getAutoDifficulty, AUTO_XML_NUM]);
    // useEffect(() => {
    //     if (difficulty === AUTO_XML_NUM && xml.length > 1 && xml[AUTO_XML_NUM]) { // AUTO_XML_NUM (0) を使用
    //         const currentProficiency = userProficiency;
    //         console.log(`[Practice ProfEffect] ユーザー習熟度: ${currentProficiency}、自動モード有効。`); // `[Practice ProfEffect] UserProficiency: ${currentProficiency}, Auto mode active.`
            
    //         const updateSheetForProficiency = async () => {
    //             if (!cursorRef.current || !cursorRef.current.iterator) {
    //                 console.warn("[Practice ProfEffect] 習熟度更新のためのカーソルまたはイテレータが準備できていません。カーソルを待機します。"); // "[Practice ProfEffect] Cursor or iterator not ready for proficiency update. Waiting for cursor."
    //                 return;
    //             }

    //             saveCursorPosition(); // 現状のカーソル位置を保存

    //             isUpdatingXmlForProficiencyRef.current = true; // フラグON

    //             try {
    //                 const iterator = cursorRef.current.iterator;
    //                 // 現在の小節番号を取得。終端に達している場合は最後の小節の次とするか、あるいは楽譜全体の長さを考慮。
    //                 // ここでは、終端なら最終小節番号 + 1、そうでなければ現在の小節番号とする。
    //                 let currentMeasureNumberForUpdateStart: number;
    //                 if (iterator.EndReached) {
    //                     const lastMeasure = osmdRef.current?.Sheet?.SourceMeasures?.length;
    //                     currentMeasureNumberForUpdateStart = lastMeasure ? lastMeasure + 1 : 1;
    //                      console.log(`[Practice ProfEffect] カーソルが末尾です。更新開始小節の計算に最後の小節番号 (${lastMeasure}) を使用します。`);
    //                 } else {
    //                     currentMeasureNumberForUpdateStart = iterator.CurrentMeasure?.MeasureNumber ?? 1;
    //                      console.log(`[Practice ProfEffect] 現在のカーソル小節番号: ${currentMeasureNumberForUpdateStart}`);
    //                 }

    //                 const autoDiff = getAutoDifficulty(currentProficiency);
    //                 const baseXmlToUpdate = xml[AUTO_XML_NUM]; // 0番目のXML (自動更新用)
    //                 const newDifficultyXml = xml[autoDiff]; // 習熟度に合わせた難易度のXML (1-5番目)

    //                 if (!newDifficultyXml) {
    //                     console.warn(`[Practice ProfEffect] 目標の自動難易度 ${autoDiff} のXMLが見つかりません。`); // `[Practice ProfEffect] XML for target auto-difficulty ${autoDiff} not found.`
    //                     isUpdatingXmlForProficiencyRef.current = false;
    //                     return;
    //                 }

    //                 const parser = new DOMParser();
    //                 const xmlDocA = parser.parseFromString(baseXmlToUpdate, 'application/xml');
    //                 const measuresA = Array.from(xmlDocA.querySelectorAll('measure'));
    //                 // 更新開始は「現在のカーソル位置の2小節先」から
    //                 const startMeasureForUpdate = currentMeasureNumberForUpdateStart + 2;
    //                 // console.log(`[Practice ProfEffect] ${measuresA[10].getAttribute('number')}`)
    //                 const targetMeasureNumbers = measuresA
    //                     .map(m => m.getAttribute('number'))
    //                     .filter(nStr => {
    //                         if (!nStr) return false;
    //                         const n = parseInt(nStr, 10);
    //                         return !isNaN(n) && n >= startMeasureForUpdate;
    //                     }) as string[];

    //                 if (targetMeasureNumbers.length > 0) {
    //                     console.log(`[Practice ProfEffect] 習熟度 ${currentProficiency} (自動難易度 ${autoDiff}) のため、小節 ${startMeasureForUpdate} から更新します。`); // `[Practice ProfEffect] Updating measures from ${startMeasureForUpdate} for proficiency ${currentProficiency} (to auto-difficulty ${autoDiff})`
    //                     let workingXml = baseXmlToUpdate;
    //                     let actualChangesMade = false;
    //                     let anyReplaceFailed = false;
    //                     console.log(`[Practice ProfEffect] 対象小節: ${targetMeasureNumbers.join(', ')}`); // `[Practice ProfEffect] Target measures: ${targetMeasureNumbers.join(', ')}`
    //                     for (const mn of targetMeasureNumbers) {
    //                         const nextXml = await replaceMeasure(workingXml, newDifficultyXml, mn);
    //                         if (nextXml) {
    //                             if (workingXml !== nextXml) {
    //                                 actualChangesMade = true;
    //                                 // console.log(`[Practice ProfEffect] 小節 ${mn} の置換に成功しました。`); // `[Practice ProfEffect] Successfully replaced measure ${mn}.`
    //                             }
    //                             // console.log(`[Practice ProfEffect] nextXML: ${nextXml}`); // `[Practice ProfEffect] nextXml: ${nextXml}`
    //                             workingXml = nextXml;
    //                         } else {
    //                             console.warn(`[Practice ProfEffect] 小節 ${mn} の置換に失敗しました。これ以上の置換を中止します。`); // `[Practice ProfEffect] Failed to replace measure ${mn}. Aborting further replacements.`
    //                             anyReplaceFailed = true;
    //                             break;
    //                         }
    //                     }
    //                     console.log(`[Practice ProfEffect] anyReplaceFailed:${anyReplaceFailed}, actualChangesMade:${actualChangesMade}`); // `[Practice ProfEffect] XML after replacements: ${workingXml}`
    //                     if (!anyReplaceFailed && actualChangesMade) {
    //                         console.log("[Practice ProfEffect] XMLが正常に変更されました。setXmlを呼び出します。"); // "[Practice ProfEffect] XML successfully modified, calling setXml."
    //                         setXml(prevXml => {
    //                             const newXmlArray = [...prevXml];
    //                             newXmlArray[AUTO_XML_NUM] = workingXml; // 0番目を更新
    //                             return newXmlArray;
    //                         });
    //                     } else if (anyReplaceFailed) {
    //                         console.log("[Practice ProfEffect] replaceMeasure の失敗によりXML更新が中止されました。setXmlを呼び出しません。"); // "[Practice ProfEffect] XML update aborted due to replaceMeasure failure. Not calling setXml."
    //                     } else {
    //                         console.log("[Practice ProfEffect] XMLへの実際の変更はありません。setXmlを呼び出しません。"); // "[Practice ProfEffect] No actual changes to XML. Not calling setXml."
    //                     }
    //                 } else {
    //                      console.log("[Practice ProfEffect] 習熟度変更のために更新する対象の小節がありません。"); // "[Practice ProfEffect] No target measures to update for proficiency change."
    //                 }
    //             } catch (error) {
    //                  console.error("[Practice ProfEffect] 習熟度に応じたXML置換中にエラーが発生しました:", error); // "[Practice ProfEffect] Error during XML replacement for proficiency:", error
    //             } finally {
    //                 isUpdatingXmlForProficiencyRef.current = false; // ★ 即座に false に設定
    //                 console.log(`[Practice ProfEffect] isUpdatingXmlForProficiencyRef set to false (finally block).`); // デバッグ用
    //                 //  setTimeout(() => { isUpdatingXmlForProficiencyRef.current = false; }, 100); // 少し遅延させてフラグを戻す
    //             }
    //         };
    //         updateSheetForProficiency();
    //     }
    // }, [userProficiency, difficulty, saveCursorPosition, getAutoDifficulty, AUTO_XML_NUM]); // 依存配列に AUTO_XML_NUM を追加 (実際には定数だが明確化のため)
    const initialize_measuredifficulty = useCallback((xml:string,difficulty: Difficulty) => {
        const parser = new DOMParser();
        const xmlDocA = parser.parseFromString(xml, 'application/xml');
        const measuresA = Array.from(xmlDocA.querySelectorAll('measure'));
        measureDifficultiesRef.current = Array(measuresA.length).fill(difficulty) 
    }, []);
    const handlemeasureDifficultyFrom = useCallback((startMeasureNum: number, difficulty: Difficulty) => {
        measureDifficultiesRef.current = measureDifficultiesRef.current.fill(difficulty, startMeasureNum-1);
    }, []);
    const handleProficiencyUpdate = useCallback((newProficiency: number) => {
        console.log(`[Practice] handleProficiencyUpdate が呼び出されました。新しい習熟度: ${newProficiency}`); // `[Practice] handleProficiencyUpdate called with: ${newProficiency}`
        setUserProficiency(newProficiency);
    }, []);



    const handleScrollToMeasure = (measureNumber: number, smooth :boolean = true) =>     {
        const container = scrollContainerRef.current; // 事前に定義されたrefであると仮定します
        const div = mainDivRef.current; // 事前に定義されたrefであると仮定します
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
        const logicalOffsetOfLineFromContainerTop = (referenceTopY - containerRect.top) / ZOOM_RATE;
        // 2. 段の「コンテナのコンテンツ先頭からの絶対的な論理オフセット」を計算
        // (現在のスクロール位置 + 現在のビューでの段の論理的なオフセット)
        const absoluteLogicalOffsetOfLine = container.scrollTop + logicalOffsetOfLineFromContainerTop;
        // 3. 目標マージンの「論理的な」値を計算
        const logicalMargin = desiredVisualMarginPx / ZOOM_RATE;
        // 4. 目標とするscrollTopは、段の絶対論理オフセットから論理マージンを引いた値
        let targetScrollTop = absoluteLogicalOffsetOfLine - logicalMargin;
        // scrollTop が負の値にならないように0でクランプする
        targetScrollTop = Math.max(0, targetScrollTop);
        // const currentScrollTopBeforeSet = container.scrollTop; // 設定前のscrollTopをログ用に保持
        // container.scrollTop = targetScrollTop; // スクロール位置を設定
        if (smooth) {
            const divnum = 3;
            const sleep = (msec : number) => new Promise(resolve => setTimeout(resolve, msec));
            (async () => {
                let nowScrollTop =  container.scrollTop; // スクロール位置を設定
                const beforeScrollTop = nowScrollTop; // スクロール前の位置を保持
                while (nowScrollTop < targetScrollTop-divnum || nowScrollTop > targetScrollTop+divnum) {
                    if (nowScrollTop < targetScrollTop-divnum){
                        nowScrollTop += divnum; // スクロール位置を設定
                    }else if (nowScrollTop > targetScrollTop+divnum) {
                        nowScrollTop -= divnum; // スクロール位置を設定
                    }
                    container.scrollTo({
                        top: nowScrollTop,
                        // behavior: 'smooth'
                    });
                    await sleep(10/Math.max(beforeScrollTop - targetScrollTop, targetScrollTop - beforeScrollTop)); // スクロール速度を調整
                }
            })();
        }
        container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
        });
        // デバッグログ
        // console.log(`[DEBUG] measureNumber: ${measureNumber}`);
        // console.log(`[DEBUG] container.scrollTop (before set): ${currentScrollTopBeforeSet.toFixed(2)}`);
        // console.log(`[DEBUG] referenceTopY (from lineGroup or svgMeasure): ${referenceTopY.toFixed(2)}`);
        // console.log(`[DEBUG] containerRect.top: ${containerRect.top.toFixed(2)}`);
        // console.log(`[DEBUG] zoom_rate: ${ZOOM_RATE}`); // zoom_rateが正しく参照されているか確認
        // console.log(`[DEBUG] logicalOffsetOfLineFromContainerTop: ${logicalOffsetOfLineFromContainerTop.toFixed(2)}`);
        // console.log(`[DEBUG] absoluteLogicalOffsetOfLine: ${absoluteLogicalOffsetOfLine.toFixed(2)}`);
        // console.log(`[DEBUG] desiredVisualMarginPx: ${desiredVisualMarginPx}`);
        // console.log(`[DEBUG] logicalMargin: ${logicalMargin.toFixed(2)}`);
        // console.log(`[DEBUG] targetScrollTop (calculated): ${targetScrollTop.toFixed(2)}`);
        // console.log(`[DEBUG] container.scrollTop (after set): ${container.scrollTop.toFixed(2)}`);
        };

    const getMeasureDifficulty = useCallback((measureNumber: number, nowdifficulty: Difficulty =difficulty): Difficulty => {
        // measureDifficultiesRef.current は 0-indexed なので、measureNumber - 1 を使用
        if (nowdifficulty === 0) {
            if (measureNumber < 1 || measureNumber > measureDifficultiesRef.current.length) {
                console.warn(`[Practice] getMeasureDifficulty: 小節番号 ${measureNumber} は範囲外です。`); // `[Practice] getMeasureDifficulty: Measure number ${measureNumber} is out of range.`
                return 0; // 範囲外の場合はデフォルトの難易度を返す
            }
            return measureDifficultiesRef.current[measureNumber - 1] as Difficulty; // 0-indexedなので、measureNumber - 1
        }else if( nowdifficulty > 0 && nowdifficulty <= MAX_DIFFICULTY) {
            // 難易度付きモードの場合、measureDifficultiesRef.current は常に難易度に対応する値を持つ
            return nowdifficulty; // 難易度付きモードでは、measureNumberに関係なく難易度を返す
        }else{
            console.warn(`[Practice] getMeasureDifficulty: 無効な難易度 ${nowdifficulty} が指定されました。`); // `[Practice] getMeasureDifficulty: Invalid difficulty ${difficulty} specified.`
            return 0;
        }
    }, []); // 依存配列は空で、measureDifficultiesRef.current はコンポーネントスコープの変数


    // const handleScrollToMeasure = useCallback((measureNumber: number) => {
    //     const container = scrollContainerRef.current;
    //     const div = mainDivRef.current; // OSMDが描画されるdiv
    //     if (!container || !div || !osmdRef.current || !osmdRef.current.GraphicSheet) {
    //         console.warn("[Practice Scroll] スクロールに必要なrefまたはGraphicSheetが利用できません。"); // "[Practice Scroll] Required refs or GraphicSheet not available for scrolling."
    //         return;
    //     }

    //     let targetMeasureGraphical: any = null; // GraphicalMeasure 型を OpenSheetMusicDisplay からインポートするのが理想
    //     // osmdRef.current.GraphicSheet.MeasureList を使う方が直接的かもしれない
    //     if (osmdRef.current.GraphicSheet.MeasureList.length > measureNumber -1 && measureNumber > 0) {
    //         const measuresInSystem = osmdRef.current.GraphicSheet.MeasureList[measureNumber-1];
    //         if (measuresInSystem && measuresInSystem.length > 0) {
    //              // 通常、最初の譜表の最初の小節フラグメントで十分
    //             targetMeasureGraphical = measuresInSystem[0];
    //         }
    //     }

    //     // レンダリングされたSVGから直接探す (フォールバックまたは代替手段)
    //     // ID形式はOSMDバージョンや設定に依存する可能性がある
    //     // `vf-measure-X` や `measure-mX` など
    //     const svgMeasureById = div.querySelector(`g[id*="measure-${measureNumber}"], g[id$="-m${measureNumber}"], g[id="m${measureNumber}"]`);


    //     if (!svgMeasureById && !targetMeasureGraphical) {
    //         console.warn(`[Practice Scroll] 小節 ${measureNumber} のSVG要素またはGraphicalMeasureが見つかりません。`); // `[Practice Scroll] SVG element or GraphicalMeasure for measure ${measureNumber} not found.`
    //         return;
    //     }

    //     let referenceTopY: number;
    //     if (targetMeasureGraphical && targetMeasureGraphical.PositionAndShape) { // GraphicalMeasureから位置を取得 (推奨)
    //         // GraphicalMeasure の絶対Y座標を取得する (MusicSystemのY座標 + Measureの相対Y座標)
    //         const measureAbsoluteY = targetMeasureGraphical.PositionAndShape.AbsolutePosition.y;
    //         // OSMDの内部単位は通常1/10pxなので、10倍してピクセル単位に変換
    //         referenceTopY = measureAbsoluteY * osmdRef.current.zoom * 10;
    //         // ただし、getBoundingClientRectが使えるSVG要素があるならそちらがより簡単で正確な場合が多い
    //          if (svgMeasureById) {
    //             referenceTopY = svgMeasureById.getBoundingClientRect().top;
    //          } else {
    //             // SVG要素が見つからない場合、計算したYを使うが、コンテナのオフセットを考慮する必要がある
    //             referenceTopY = (container.getBoundingClientRect().top + measureAbsoluteY * osmdRef.current.zoom * 10);
    //             // この計算は複雑で不正確になりやすい。SVG要素の利用を推奨。
    //             console.warn("[Practice Scroll] SVG要素なしでGraphicalMeasureからY位置を計算しましたが、不正確な可能性があります。");
    //          }
    //     } else if (svgMeasureById) { // SVG要素から位置を取得
    //         const lineGroup = svgMeasureById.closest('g.vf-stave') || svgMeasureById; // vf-stave (譜線グループ) を基準にする
    //         referenceTopY = lineGroup.getBoundingClientRect().top;
    //     } else {
    //         return; // ここには到達しないはず
    //     }

    //     const containerRect = container.getBoundingClientRect();
    //     const desiredVisualMarginPx = 20; // 画面上部からのマージン（ピクセル）
    //     // スクロールコンテナ内でのターゲット要素の上端の相対位置
    //     const elementTopRelativeToContainer = referenceTopY - containerRect.top;
    //     // ズームを考慮した論理的なスクロール量
    //     const targetScrollTop = container.scrollTop + (elementTopRelativeToContainer / ZOOM_RATE) - (desiredVisualMarginPx / ZOOM_RATE);

    //     container.scrollTop = Math.max(0, targetScrollTop);
    //     console.log(`[Practice Scroll] 小節 ${measureNumber} へスクロールしました。targetScrollTop: ${targetScrollTop.toFixed(2)}`); // `[Practice Scroll] Scrolled to measure ${measureNumber}, targetScrollTop: ${targetScrollTop.toFixed(2)}`
    // }, [ZOOM_RATE]);


    return (
        // JSX部分は変更なし
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <header style={{ padding: '1rem', background: '#f0f0f0', flexShrink: 0 }}>
                {/* <h1>{title}</h1> */}
                <LinkButton text="ホーム画面" link="/home" />
                <button onClick={() => handleScrollToMeasure(2)}>スクロール2</button>
                <button onClick={() => handleScrollToMeasure(10)}>スクロール10</button> {/* ログに合わせて修正 */}
            </header>
            <main ref={scrollContainerRef} style={{ flexGrow: 1, overflow: 'auto', background: '#ffffff', padding: '1rem', width: `${100 / ZOOM_RATE}vw`, zoom: `${ZOOM_RATE}` }}>
                <div ref={mainDivRef} />
                <div style={{ height: '100vh' }} /> {/* スペーサー */}
            </main>
            <footer style={{ padding: '1rem', background: '#f0f0f0', flexShrink: 0, width: '100vw' }}>
                <p style={{ margin: 0 }}>フッター</p>
                {osmdRef.current && (
                    <OSMDPlayer
                        osmd={osmdRef}
                        difficulty={difficulty}
                        accompanimentXml={accompanimentXmlRef.current}
                        basebpm={musicbpmRef.current}
                        onDifficultyChange={handleDifficultyChange}
                        onProficiencyUpdate={handleProficiencyUpdate}
                        getMeasureDifficulty={getMeasureDifficulty}
                        // getCurrentMeasure={() => cursorRef.current?.iterator?.CurrentMeasure?.MeasureNumber ?? 1}
                        onRequestScrollToMeasure={handleScrollToMeasure}
                    />
                )}
            </footer>
        </div>
    );
}