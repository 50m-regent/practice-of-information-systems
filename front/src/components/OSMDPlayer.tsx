import React, { useEffect, useRef, useState, useCallback } from 'react';
import { OpenSheetMusicDisplay, VoiceEntry, Note } from 'opensheetmusicdisplay';
import { Difficulty } from '../types/types'; // 型定義ファイル（存在すると仮定）
// アイコンのインポート
import { IoMusicalNotesOutline } from 'react-icons/io5';
import { MdQueueMusic } from "react-icons/md";
import { LuPiano } from "react-icons/lu";
import { TbMetronome } from 'react-icons/tb';

// --- インターフェース定義 ---
interface OSMDPlayerProps {
  osmd: React.RefObject<OpenSheetMusicDisplay>; // 表示用OSMDインスタンスへの参照
  difficulty: Difficulty;                         // 現在の難易度
  accompanimentXml?: string | null;               // 伴奏用MusicXML文字列 (任意)
  basebpm: number;                                // 基本となるBPM
  onDifficultyChange: (difficulty: Difficulty) => void; // 難易度変更時に呼び出されるコールバック
  onProficiencyUpdate: (newProficiency: number) => void; // 習熟度更新時に呼び出されるコールバック
  getMeasureDifficulty?: (measureNumber: number, difficulty: Difficulty) => Difficulty; // 特定の小節の難易度を取得する関数 (任意)
  onRequestScrollToMeasure: (measureNumber: number, smooth?: boolean) => void; // 特定の小節へのスクロールを要求するコールバック
}

// 再生スタイルの型定義
type PlaybackStyle = 'score' | 'metronome' | 'accompaniment'; // 'score': 楽譜通り, 'metronome': メトロノーム, 'accompaniment': 伴奏

// ダミーの習熟度を生成する関数 (1から10のランダムな整数)
const getDummyProficiency = (): number => {
    return Math.floor(Math.random() * 10) + 1;
};

// --- OSMDPlayerコンポーネント定義 ---
export function OSMDPlayer({
    osmd,
    difficulty,
    accompanimentXml,
    basebpm,
    onDifficultyChange,
    onProficiencyUpdate,
    getMeasureDifficulty, // 現時点ではこのコンポーネント内では直接使用されていません
    onRequestScrollToMeasure,
}: OSMDPlayerProps) {

    // --- State定義 ---
    // isPlaying: 再生中かどうかを示す状態 (true: 再生中, false: 停止中)
    const [isPlaying, setIsPlaying] = useState(false);
    // playbackStyle: 現在の再生スタイル ('score', 'metronome', 'accompaniment')
    const [playbackStyle, setPlaybackStyle] = useState<PlaybackStyle>('score');
    // isRecordingEnabled: 録音機能が有効かどうかを示す状態 (UIでトグル可能)
    const [isRecordingEnabled, setIsRecordingEnabled] = useState(true);

    // --- Ref定義 (DOM要素やミュータブルな値を保持) ---
    // timerIdRef: 再生ループのsetTimeoutのIDを保持
    const timerIdRef = useRef<number | null>(null);
    // audioContextRef: Web Audio APIのAudioContextインスタンスを保持
    const audioContextRef = useRef<AudioContext | null>(null);
    // currentBpmRato: 基本BPMからの差分を保持 (BPM調整用)
    const [currentBpmRato, setCurrentBpmRato] = useState<number>(0);
    // musicClipRef: 再生した音の周波数とデュレーションのペアを記録 (現状、活用方法は限定的)
    const musicClipRef = useRef<[number, number][]>([]);

    // mediaRecorderRef: MediaRecorderインスタンスを保持 (録音用)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    // isRecording: 現在実際に録音中かどうかを示す状態 (MediaRecorderの状態と同期)
    const [isRecording, setIsRecording] = useState(false);
    // audioChunksRef: 録音されたオーディオデータを一時的に保持する配列
    const audioChunksRef = useRef<Blob[]>([]);
    // streamRef: マイクからのMediaStreamを保持
    const streamRef = useRef<MediaStream | null>(null);
    // currentMeasureForRecordingRef: 現在録音対象となっている小節番号を保持
    const currentMeasureForRecordingRef = useRef<number>(1);

    // isPlayingRef: isPlayingステートの最新値をrefで保持 (コールバック内で最新値にアクセスするため)
    const isPlayingRef = useRef(isPlaying);
    // isRecordingRef: isRecordingステートの最新値をrefで保持
    const isRecordingRef = useRef(isRecording);
    // isRecordingEnabledRef: isRecordingEnabledステートの最新値をrefで保持
    const isRecordingEnabledRef = useRef(isRecordingEnabled);


    // --- useEffectフック (ステート変更に伴う副作用の処理) ---
    // isPlayingステートが変更されたら、isPlayingRef.currentも更新
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    // isRecordingステートが変更されたら、isRecordingRef.currentも更新
    useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
    // isRecordingEnabledステートが変更されたら、isRecordingEnabledRef.currentも更新
    useEffect(() => { isRecordingEnabledRef.current = isRecordingEnabled; }, [isRecordingEnabled]);


    // playbackOsmdContainerRef: 伴奏譜面再生用の非表示OSMDインスタンスを描画するdiv要素への参照
    const playbackOsmdContainerRef = useRef<HTMLDivElement>(null);
    // playbackOsmdRef: 伴奏譜面再生用のOSMDインスタンスを保持
    const playbackOsmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    // isPlaybackOsmdReady: 伴奏譜面再生用OSMDインスタンスが初期化完了したかを示す状態
    const [isPlaybackOsmdReady, setIsPlaybackOsmdReady] = useState(false);

    // コンポーネントマウント時に伴奏譜面再生用のOSMDインスタンスを初期化
    useEffect(() => {
        if (playbackOsmdContainerRef.current && !playbackOsmdRef.current) {
            console.log("[OSMDPlayer] Initializing playback OSMD instance...");
            try {
                const instance = new OpenSheetMusicDisplay(playbackOsmdContainerRef.current, {
                    autoResize: false, backend: "svg", drawTitle: false, drawSubtitle: false,
                    drawComposer: false, drawLyricist: false, drawMetronomeMarks: false,
                    drawPartNames: false, drawMeasureNumbers: false, // 伴奏用なので表示関連はオフ
                });
                playbackOsmdRef.current = instance;
                setIsPlaybackOsmdReady(true);
                console.log("[OSMDPlayer] Playback OSMD instance initialized successfully.");
            } catch (error) {
                console.error("[OSMDPlayer] Failed to initialize playback OSMD instance:", error);
                setIsPlaybackOsmdReady(false);
            }
        }
        // アンマウント時のクリーンアップ (OSMDインスタンスの破棄など) が必要であればここに追加
        // return () => { if (playbackOsmdRef.current) { /* playbackOsmdRef.current.dispose?.() */ } };
    }, []); // 空の依存配列なのでマウント時に一度だけ実行


    // --- コールバック関数定義 (useCallbackでメモ化) ---
    // getNoteDurationMs: 音符の相対的な長さ(RealValue)とBPMから、ミリ秒単位のデュレーションを計算
    const getNoteDurationMs = useCallback((duration: number, bpm: number) => (60 / bpm) * 1000 * duration * 4, []);
    // midiNoteNumberToFrequency: MIDIノート番号を周波数(Hz)に変換
    const midiNoteNumberToFrequency = useCallback((midiNoteNumber: number): number => 440 * Math.pow(2, (midiNoteNumber - 69) / 12), []);

    // handlebpmChange: BPMを変更する (UIからの呼び出し用)
    const handlebpmChange = useCallback((doUp : boolean) => {
        if(doUp) setCurrentBpmRato(prev => prev + 10); // 10上げる
        else setCurrentBpmRato(prev => Math.max(prev - 10, 10 - basebpm)); // 10下げる (ただしbasebpm-10未満にはしない)
    }, [basebpm]); // basebpmが変更されたら再生成

    // getCurrentBpm: 現在の有効なBPMを取得 (basebpmとcurrentBpmRatoから計算)
    const getCurrentBpm = useCallback(() => basebpm + currentBpmRato, [basebpm, currentBpmRato]);

    // playBeep: 指定された周波数とデュレーションでビープ音を再生
    const playBeep = useCallback((frequency: number, durationMs: number) => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            console.warn("[OSMDPlayer] playBeep: AudioContext not available or closed.");
            return;
        }
        try {
            const oscillator = audioContextRef.current.createOscillator(); // オシレーター生成
            oscillator.type = 'sine'; // 波形タイプ (サイン波)
            oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime); // 周波数設定
            oscillator.connect(audioContextRef.current.destination); // 出力に接続
            oscillator.start(); // 再生開始
            oscillator.stop(audioContextRef.current.currentTime + durationMs / 1000); // 指定時間後に停止
        } catch (e) {
            console.error("[OSMDPlayer] playBeep error:", e);
        }
    }, []); // 依存なし (audioContextRef.currentはrefなので依存配列に不要)

    // startRecording: マイク録音を開始
    const startRecording = useCallback(async () => {
        console.log("[OSMDPlayer] startRecording called. isRecordingRef.current:", isRecordingRef.current, "isRecordingEnabledRef.current:", isRecordingEnabledRef.current);
        // 既に録音中か、録音機能が無効なら何もしない (isRecordingEnabledRefで最新の状態を確認)
        if (isRecordingRef.current || !isRecordingEnabledRef.current) {
            console.log("[OSMDPlayer] startRecording: returning early. isRecordingRef:", isRecordingRef.current, "isRecordingEnabledRef:", isRecordingEnabledRef.current);
            return;
        }
        try {
            console.log("[OSMDPlayer] startRecording: requesting user media...");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // マイクへのアクセス許可要求
            console.log("[OSMDPlayer] startRecording: user media obtained.");
            streamRef.current = stream; // ストリームをrefに保持
            const mr = new MediaRecorder(stream); // MediaRecorderインスタンス生成
            mediaRecorderRef.current = mr;
            audioChunksRef.current = []; // 録音データチャンク配列を初期化
            mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); }; // データが得られたらチャンクに追加
            mr.onerror = (e) => { console.error("[OSMDPlayer] MediaRecorder error (in MediaRecorder instance):", e); }; // MediaRecorder自体のエラーハンドリング
            mr.start(); // 録音開始
            console.log("[OSMDPlayer] startRecording: mr.start() called.");
            setIsRecording(true); // 録音中ステートをtrueに (これによりisRecordingRefも更新される)
            console.log("[OSMDPlayer] startRecording: setIsRecording(true) called.");
        } catch (err) {
            console.error('[OSMDPlayer] Mic record start failed:', err);
            // エラー発生時はストリームとレコーダーをクリーンアップ
            if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
            mediaRecorderRef.current = null;
            setIsRecording(false);
        }
    }, []); // 依存配列は空 (isRecordingEnabledRef.current を使用するため、isRecordingEnabled stateに直接依存しない)

    // stopAndSendRecording: マイク録音を停止し、録音データを処理 (習熟度更新など)
    const stopAndSendRecording = useCallback(async (measureNumber: number) => {
        const mr = mediaRecorderRef.current;
        console.log("[OSMDPlayer] stopAndSendRecording called for measure:", measureNumber, "mr.state:", mr?.state, "isRecordingEnabledRef.current:", isRecordingEnabledRef.current);

        // MediaRecorderがないか、既に非アクティブならクリーンアップして終了
        if (!mr || mr.state === 'inactive') {
            console.log("[OSMDPlayer] stopAndSendRecording: no active recorder or already inactive.");
            if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
            mediaRecorderRef.current = null;
            if(isRecordingRef.current) setIsRecording(false); // isRecordingステートがtrueのままならfalseに更新
            return;
        }

        // Promiseを返して、録音停止とデータ処理の完了を待てるようにする
        return new Promise<void>((resolve, reject) => {
            mr.onstop = async () => { // MediaRecorderの停止イベントハンドラ
                console.log("[OSMDPlayer] stopAndSendRecording: mr.onstop triggered.");
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // 録音チャンクからBlobを生成
                audioChunksRef.current = []; // チャンク配列をクリア
                // 録音機能が有効で、データサイズが0より大きければ習熟度を更新
                if (isRecordingEnabledRef.current && audioBlob.size > 0) {
                    console.log("[OSMDPlayer] stopAndSendRecording: updating proficiency.");
                    onProficiencyUpdate(getDummyProficiency()); // 親コンポーネントに習熟度を通知
                }
                // ストリームとレコーダーのクリーンアップ
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                mediaRecorderRef.current = null;
                setIsRecording(false); // 録音中ステートをfalseに
                console.log("[OSMDPlayer] stopAndSendRecording: setIsRecording(false) in onstop. Resolving.");
                resolve(); // Promiseを解決
            };
            mr.onerror = (event: Event) => { // MediaRecorderのエラーイベントハンドラ
                console.error("[OSMDPlayer] stopAndSendRecording: mr.onerror", event);
                // エラー時もクリーンアップ
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                mediaRecorderRef.current = null;
                setIsRecording(false);
                console.error("[OSMDPlayer] stopAndSendRecording: MediaRecorder error. Rejecting.");
                reject(new Error("MediaRecorder error during stop: " + (event.type || "Unknown error"))); // Promiseを拒否
            };

            // MediaRecorderが録音中または一時停止中であれば停止する
            if (mr.state === 'recording' || mr.state === 'paused') {
                console.log("[OSMDPlayer] stopAndSendRecording: calling mr.stop(). Current state:", mr.state);
                try {
                    mr.stop();
                } catch (e) {
                    console.error("[OSMDPlayer] stopAndSendRecording: Error calling mr.stop() directly.", e);
                    // mr.stop()が同期的エラーを投げた場合もクリーンアップしてreject
                    streamRef.current?.getTracks().forEach(t => t.stop());
                    streamRef.current = null;
                    mediaRecorderRef.current = null;
                    setIsRecording(false);
                    reject(e);
                }
            } else {
                // それ以外の状態であれば、既に止まっているか予期せぬ状態。クリーンアップしてresolve。
                console.warn("[OSMDPlayer] stopAndSendRecording: mr.state was not 'recording' or 'paused'. State:", mr.state, "Resolving anyway with cleanup.");
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                mediaRecorderRef.current = null;
                setIsRecording(false);
                resolve();
            }
        });
    }, [onProficiencyUpdate]); // onProficiencyUpdateが変更されたら再生成 (isRecordingEnabledRefはrefなので依存に含めない)

    // stopPlaybackCallback: 再生を停止し、関連リソースをクリーンアップする関数本体
    const stopPlaybackCallback = useCallback(async (triggeredByPlayPause = false) => {
        console.log("[OSMDPlayer] stopPlaybackCallback called. isPlayingRef.current:", isPlayingRef.current, "triggeredByPlayPause:", triggeredByPlayPause);
        // 再生中でない、かつUIの再生/停止ボタン経由でないなら何もしない
        if (!isPlayingRef.current && !triggeredByPlayPause) {
            console.log("[OSMDPlayer] stopPlaybackCallback: not playing and not triggered by play/pause. Returning.");
            return;
        }
        setIsPlaying(false); // 再生中ステートをfalseに (これによりisPlayingRefも更新される)

        if (timerIdRef.current !== null) { clearTimeout(timerIdRef.current); timerIdRef.current = null; } // 再生ループタイマーをクリア

        // AudioContextをクローズ (存在し、かつ 'running' または 'suspended' 状態の場合)
        if (audioContextRef.current) {
            if (audioContextRef.current.state === 'running' || audioContextRef.current.state === 'suspended') {
                try {
                    console.log("[OSMDPlayer] stopPlaybackCallback: Closing AudioContext. State:", audioContextRef.current.state);
                    await audioContextRef.current.close();
                    console.log("[OSMDPlayer] stopPlaybackCallback: AudioContext closed.");
                } catch (e) { console.error("[OSMDPlayer] stopPlaybackCallback: AC close error:", e); }
            } else {
                console.warn("[OSMDPlayer] stopPlaybackCallback: AudioContext not in 'running' or 'suspended' state. State:", audioContextRef.current.state);
            }
            audioContextRef.current = null; // 参照をクリア
        }

        // もし録音中だったら録音を停止
        if (isRecordingRef.current) {
            console.log("[OSMDPlayer] stopPlaybackCallback: Was recording, calling stopAndSendRecording.");
            try {
                await stopAndSendRecording(currentMeasureForRecordingRef.current);
            } catch (e) {
                console.error("[OSMDPlayer] stopPlaybackCallback: error in stopAndSendRecording:", e);
            }
        }

        // OSMDカーソルを非表示にし、リセット
        osmd.current?.cursor.hide();
        osmd.current?.cursor.reset();
        playbackOsmdRef.current?.cursor.hide();
        playbackOsmdRef.current?.cursor.reset();
        console.log("[OSMDPlayer] stopPlaybackCallback finished.");
    }, [osmd, stopAndSendRecording]); // osmdとstopAndSendRecordingが変更されたら再生成

    // stopPlaybackRef: stopPlaybackCallbackの最新版を保持するref (useEffectのクリーンアップ関数内から最新版を呼ぶため)
    const stopPlaybackRef = useRef(stopPlaybackCallback);
    useEffect(() => {
        stopPlaybackRef.current = stopPlaybackCallback;
    }, [stopPlaybackCallback]); // stopPlaybackCallbackが再生成されたらrefも更新

    // コンポーネントのアンマウント時に実行されるクリーンアップ処理
    useEffect(() => {
        return () => {
            console.log("[OSMDPlayer] Unmount effect. isPlayingRef.current:", isPlayingRef.current);
            if (isPlayingRef.current) { // アンマウント時に再生中だったら停止処理を呼び出す
                stopPlaybackRef.current(true); // triggeredByPlayPauseをtrueとして、isPlayingRefの状態に関わらず停止を試みる
            } else {
                // 再生中でなかった場合の最小限のクリーンアップ
                if (timerIdRef.current !== null) clearTimeout(timerIdRef.current);
                if (audioContextRef.current && (audioContextRef.current.state === 'running' || audioContextRef.current.state === 'suspended')) {
                     audioContextRef.current.close().catch(e => console.error("Unmount AC close error (not playing):", e));
                }
                audioContextRef.current = null;

                // MediaRecorderとMediaStreamのクリーンアップ
                const mr = mediaRecorderRef.current;
                if (mr && (mr.state === 'recording' || mr.state === 'paused')) {
                    console.log("[OSMDPlayer] Unmount: stopping active MediaRecorder. State:", mr.state);
                    mr.onstop = () => { // アンマウント用の簡略化されたonstop
                        console.log("[OSMDPlayer] Unmount: MediaRecorder stopped.");
                        streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
                        mediaRecorderRef.current = null;
                    };
                    mr.onerror = (e) => { // エラーハンドラも設定
                        console.error("[OSMDPlayer] Unmount: MediaRecorder error on stop.", e);
                        streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
                        mediaRecorderRef.current = null;
                    };
                    try {
                        mr.stop();
                    } catch (e) { // stop()が同期エラーを投げる稀なケースに対応
                         console.error("[OSMDPlayer] Unmount: Error calling mr.stop() directly.", e);
                         streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
                         mediaRecorderRef.current = null;
                    }
                } else if (streamRef.current) { // MediaRecorderはないがストリームだけ残っている場合
                    console.log("[OSMDPlayer] Unmount: Stopping MediaStream tracks as MediaRecorder was not active.");
                    streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null;
                }
            }
            // if (playbackOsmdRef.current) { playbackOsmdRef.current.dispose?.(); } // OSMDに破棄メソッドがあれば呼び出す
        };
    }, []); // 依存配列が空なので、アンマウント時に一度だけ実行される

    // executePlaybackLoop: 実際の再生ループ処理を行う関数
    const executePlaybackLoop = useCallback(async (
        audioSourceOsmd: OpenSheetMusicDisplay, // 音声イベントのソースとなるOSMDインスタンス (メイン譜面または伴奏譜面)
        isAudioSourceAlsoDisplay: boolean       // audioSourceOsmdがメイン表示OSMDと同一かどうかのフラグ
    ) => {
        console.log("[OSMDPlayer] executePlaybackLoop started. isAudioSourceAlsoDisplay:", isAudioSourceAlsoDisplay, "isRecordingEnabledRef.current:", isRecordingEnabledRef.current);
        const mainDisplayOsmd = osmd.current; // メイン表示用のOSMDインスタンス
        const bpm = getCurrentBpm();
        const audioCursor = audioSourceOsmd.cursor; // 音声ソースのカーソル
        const displayCursor = mainDisplayOsmd?.cursor; // 表示用カーソル (audioCursorと同じ場合もある)

        // カーソルやイテレータの存在チェック
        if (!audioCursor || !audioCursor.iterator) {
            console.error("[OSMDPlayer] Audio source OSMD cursor or iterator not available.");
            setIsPlaying(false); return;
        }
        if (!isAudioSourceAlsoDisplay && (!displayCursor || !displayCursor.iterator)) {
            console.warn("[OSMDPlayer] Main display OSMD cursor or iterator not available for sync (when distinct from audio source).");
        }

        // カーソルの初期化と表示
        if (audioCursor.iterator.EndReached) audioCursor.reset();
        audioCursor.show();

        if (displayCursor && displayCursor !== audioCursor) { // 表示用カーソルが音声ソースと異なる場合のみ個別に初期化
            if (displayCursor.iterator.EndReached) displayCursor.reset();
            displayCursor.show();
        }
        // 初期スクロール位置の設定 (isAudioSourceAlsoDisplayに応じて適切なカーソルを使用)
        const cursorForInitialScroll = isAudioSourceAlsoDisplay ? audioCursor : displayCursor;
        if (cursorForInitialScroll?.iterator.CurrentMeasure) {
            onRequestScrollToMeasure(cursorForInitialScroll.iterator.CurrentMeasure.MeasureNumber, false);
        }

        // AudioContextの準備
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            if (audioContextRef.current) { await audioContextRef.current.close().catch(e => console.warn("Prev AC close error:", e));} // 既存があれば閉じる
            try {
                console.log("[OSMDPlayer] Creating new AudioContext.");
                audioContextRef.current = new AudioContext(); // 新規作成
            } catch (e) { console.error("AC create error:", e); setIsPlaying(false); return; }
        }

        // 録音関連の初期設定
        currentMeasureForRecordingRef.current = audioCursor.iterator.CurrentMeasure?.MeasureNumber ?? 1;
        if (isRecordingEnabledRef.current && !isRecordingRef.current) { // 録音有効かつ現在録音中でなければ録音開始
            console.log("[OSMDPlayer] executePlaybackLoop: initial startRecording call.");
            await startRecording().catch(e => console.error("Error in initial startRecording:", e));
        }
        musicClipRef.current = []; // musicClipの初期化

        // 再生ステップ処理 (非同期関数)
        const step = async () => {
            // 再生中でない、AudioContextがない、イテレータがない場合はループを停止
            if (!isPlayingRef.current || !audioContextRef.current || !audioCursor.iterator) {
                console.log("[OSMDPlayer] step: returning early (playback stopped or AC/iterator issue). isPlayingRef:", isPlayingRef.current);
                if (isRecordingRef.current) { // 録音中であれば停止処理
                    console.log("[OSMDPlayer] step: stopping recording due to early return.");
                    await stopAndSendRecording(currentMeasureForRecordingRef.current).catch(e => console.error("Error in stopAndSendRecording on early return:", e));
                }
                return;
            }

            // 音声ソースの楽譜の終端に達した場合
            if (audioCursor.iterator.EndReached) {
                console.log("[OSMDPlayer] step: audioCursor.iterator.EndReached.");
                if (isRecordingRef.current) { // 録音中であれば停止処理
                    await stopAndSendRecording(audioCursor.iterator.CurrentMeasure?.MeasureNumber ?? currentMeasureForRecordingRef.current).catch(e => console.error("Error in stopAndSendRecording on end reached:", e));
                }
                // カーソルリセットと非表示
                audioCursor.reset(); audioCursor.hide();
                if (displayCursor && displayCursor !== audioCursor) { displayCursor.reset(); displayCursor.hide(); }
                
                // 表示を先頭に戻すスクロール
                const finalCursorForScroll = isAudioSourceAlsoDisplay ? audioCursor : displayCursor;
                if (finalCursorForScroll?.iterator.CurrentMeasure) {
                    onRequestScrollToMeasure(finalCursorForScroll.iterator.CurrentMeasure.MeasureNumber, false);
                }
                setIsPlaying(false); // 再生中ステートをfalseに
                return;
            }

            // 現在のカーソル位置の音符情報を取得
            let actualVoiceEntries: VoiceEntry[] = [];
            const resultFromMethodCall = audioCursor.iterator.CurrentVisibleVoiceEntries();
            console.log("[OSMDPlayer] step: CurrentVisibleVoiceEntries:");
            console.log(resultFromMethodCall); // デバッグ用に出力
            // メソッドの返り値が配列であることを確認
            if (Array.isArray(resultFromMethodCall)) {
                actualVoiceEntries = resultFromMethodCall;
            } else {
                // 予期せず配列以外が返ってきた場合のフォールバック
                console.warn("[OSMDPlayer] CurrentVisibleVoiceEntries() did not return an array:", resultFromMethodCall);
                actualVoiceEntries = [];
            }

            // 次のステップまでの待機時間を計算
            let stepDurationMs = 100; // デフォルト
            if (actualVoiceEntries.length > 0) {
                let minDurationRealValue = Infinity;
                actualVoiceEntries.forEach(entry => { // 同時発音される音符の中で最も短い音価を探す
                    if (entry && Array.isArray(entry.Notes)) {
                        entry.Notes.forEach((note: Note) => {
                            if (note && note.Length && typeof note.Length.RealValue === 'number' && note.Length.RealValue > 0) {
                                minDurationRealValue = Math.min(minDurationRealValue, note.Length.RealValue);
                            }
                        });
                    }
                });
                if (isFinite(minDurationRealValue) && minDurationRealValue > 0) {
                    stepDurationMs = getNoteDurationMs(minDurationRealValue, bpm);
                } else { stepDurationMs = 50; } // 有効な音価が見つからなければ短い固定値
            } else { stepDurationMs = 50; } // 音符がなければ短い固定値

            // 音符の再生処理
            let notePlayedForMetronomeThisStep = false; // メトロノーム再生時に1ステップ1回だけ鳴らすためのフラグ
            // 現在の有効な再生スタイルを決定 (伴奏モードで伴奏OSMDを再生中は強制的に'score')
            const currentEffectivePlaybackStyle = (playbackStyle === 'accompaniment' && audioSourceOsmd === playbackOsmdRef.current)
                                                ? 'score' : playbackStyle;

            if (actualVoiceEntries.length > 0) {
                 actualVoiceEntries.forEach(voiceEntry => { // 各声部エントリを処理
                    if (voiceEntry && Array.isArray(voiceEntry.Notes)) {
                        voiceEntry.Notes.forEach((note: Note) => { // 各音符を処理 (通常は1つだが和音は複数VoiceEntry)
                            // 休符でなく、ピッチ情報があり、音価が0より大きい音符を再生
                            if (!note.isRest() && note.Pitch && typeof note.Pitch.getHalfTone === 'function' && note.Length && typeof note.Length.RealValue === 'number' && note.Length.RealValue > 0) {
                                const freq = midiNoteNumberToFrequency(note.Pitch.getHalfTone()); // 周波数取得
                                const individualNoteDurationMs = getNoteDurationMs(note.Length.RealValue, bpm); // 個々の音符のデュレーション
                                musicClipRef.current.push([freq, individualNoteDurationMs]); // 記録用
                                if (currentEffectivePlaybackStyle === 'score') { // 楽譜通り再生
                                    playBeep(freq, individualNoteDurationMs);
                                } else if (currentEffectivePlaybackStyle === 'metronome' && !notePlayedForMetronomeThisStep) { // メトロノーム再生
                                    playBeep(880, 100); // 固定のメトロノーム音
                                    notePlayedForMetronomeThisStep = true;
                                }
                            }
                        });
                    }
                });
            }

            // カーソル進行とスクロール処理
            if (isAudioSourceAlsoDisplay) { // 音声ソースが表示OSMDと同じ場合 (楽譜通り/メトロノームモード)
                if (audioCursor && !audioCursor.iterator.EndReached) {
                    const currentMeasureNum = audioCursor.iterator.CurrentMeasure?.MeasureNumber ?? 0;
                    if (currentMeasureNum > 0) onRequestScrollToMeasure(currentMeasureNum, false); // スクロール
                    audioCursor.next(); // カーソルを1回だけ進める
                }
            } else { // 音声ソースが表示OSMDと異なる場合 (伴奏モード)
                // 表示用カーソルを進める
                if (displayCursor && !displayCursor.iterator.EndReached) {
                    const displayMeasureNum = displayCursor.iterator.CurrentMeasure?.MeasureNumber ?? 0;
                    if (displayMeasureNum > 0) onRequestScrollToMeasure(displayMeasureNum, false);
                    displayCursor.next();
                }
                // 音声ソースカーソルも進める
                if (audioCursor && !audioCursor.iterator.EndReached) audioCursor.next();
            }

            // 小節変更時の処理 (録音の停止/再開など)
            const audioSourceCurrentMeasureNum = audioCursor.iterator.CurrentMeasure?.MeasureNumber ?? 0;
            if (audioSourceCurrentMeasureNum !== currentMeasureForRecordingRef.current && currentMeasureForRecordingRef.current > 0 && !audioCursor.iterator.EndReached) {
                console.log(`[OSMDPlayer] step: measure changed from ${currentMeasureForRecordingRef.current} to ${audioSourceCurrentMeasureNum}.`);
                if (isRecordingRef.current) { // 現在録音中であれば、前の小節の録音を停止
                    console.log("[OSMDPlayer] step: stopping current recording for measure change.");
                    await stopAndSendRecording(currentMeasureForRecordingRef.current).catch(e => console.error("Error in stopAndSendRecording on measure change:", e));
                }
                // 再生が継続している場合のみ次の処理へ
                if (isPlayingRef.current) {
                    musicClipRef.current = []; // 新しい小節のためにmusicClipをリセット
                    currentMeasureForRecordingRef.current = audioSourceCurrentMeasureNum; // 録音対象小節番号を更新
                    // 録音機能が有効で、かつ現在録音中でなければ (つまりstopAndSendRecording後)、新しい小節の録音を開始
                    if (isRecordingEnabledRef.current && !isRecordingRef.current) {
                        console.log("[OSMDPlayer] step: starting new recording for new measure.");
                        await startRecording().catch(e => console.error("Error in startRecording on measure change:", e));
                    }
                } else { // 小節変更処理の途中で再生が停止された場合
                    console.log("[OSMDPlayer] step: playback stopped during measure change logic. Returning.");
                    return; // step関数を終了
                }
            }

            // 次のステップをスケジュール
            if (isPlayingRef.current) {
                timerIdRef.current = window.setTimeout(step, Math.max(10, stepDurationMs)); // stepDurationMs後に再度stepを呼び出す
            } else { // 再生が停止した場合の最終処理
                console.log("[OSMDPlayer] step: isPlayingRef is false at end of step. Stopping recording if active.");
                if (isRecordingRef.current) await stopAndSendRecording(currentMeasureForRecordingRef.current).catch(e => console.error("Error in stopAndSendRecording at end of step:", e));
                audioCursor.hide();
                if (displayCursor && displayCursor !== audioCursor) displayCursor.hide();
            }
        }; // --- step関数の定義ここまで ---

        console.log("[OSMDPlayer] executePlaybackLoop: Kicking off first step.");
        step(); // 最初のステップを開始

    }, [ // useCallbackの依存配列
        osmd, getCurrentBpm, onRequestScrollToMeasure, startRecording,
        getNoteDurationMs, midiNoteNumberToFrequency, playbackStyle, playBeep, stopAndSendRecording,
    ]);

    // playOSMDByCursor: 再生を開始するメインの関数
    const playOSMDByCursor = useCallback(async () => {
        console.log("[OSMDPlayer] playOSMDByCursor called. isPlayingRef.current:", isPlayingRef.current);
        if (isPlayingRef.current) { // 既に再生中なら何もしない
            console.log("[OSMDPlayer] playOSMDByCursor: Already playing. Returning.");
            return;
        }
        // 念のため、再生開始前にisPlayingステートをfalseに設定 (UIの即時反応のため)
        // ただし、すぐにtrueにするので、isPlayingRefへの反映は実質setIsPlaying(true)のタイミング
        if (isPlaying) setIsPlaying(false);


        let audioSourceOsmdInstance: OpenSheetMusicDisplay | null = null; // 音声ソースとなるOSMDインスタンス
        let xmlToLoad: string | null | undefined = null; // ロードするXML文字列
        let isAudioSourceDisplay = false; // 音声ソースが表示OSMDと同じかどうかのフラグ

        // 再生スタイルに応じて音声ソースOSMDインスタンスを決定
        if (playbackStyle === 'accompaniment') { // 伴奏モード
            if (!isPlaybackOsmdReady || !playbackOsmdRef.current) {
                alert("伴奏用プレイヤーが準備できていません。"); console.error("[OSMDPlayer] Playback OSMD not ready for accompaniment."); return;
            }
            if (accompanimentXml) {
                audioSourceOsmdInstance = playbackOsmdRef.current; // 伴奏用OSMDを使用
                xmlToLoad = accompanimentXml;
                isAudioSourceDisplay = false; // 表示OSMDとは異なる
            } else {
                alert("伴奏譜がありません。"); console.error("[OSMDPlayer] Accompaniment XML not available."); return;
            }
        } else { // 楽譜通りモードまたはメトロノームモード
            if (!osmd.current) {
                alert("楽譜プレイヤーが準備できていません。"); console.error("[OSMDPlayer] Main OSMD not available."); return;
            }
            audioSourceOsmdInstance = osmd.current; // メイン表示OSMDを音声ソースとして使用
            isAudioSourceDisplay = true; // 表示OSMDと同じ
        }

        if (!audioSourceOsmdInstance) {
            console.error("[OSMDPlayer] playOSMDByCursor: audioSourceOsmdInstance is null. Cannot play."); return;
        }
        // メイン表示OSMDが常に準備できていることを確認
        if (!osmd.current || !osmd.current.cursor) {
            alert("メイン楽譜表示の準備ができていません。"); console.error("[OSMDPlayer] Main display OSMD or its cursor is not ready."); return;
        }

        // 必要であればXMLをロード (伴奏モードで、まだロードされていないか異なるXMLの場合)
        let needsLoad = false;
        if (xmlToLoad && audioSourceOsmdInstance === playbackOsmdRef.current) {
            console.log("[OSMDPlayer] Accompaniment selected, will attempt to load/reload XML.");
            // ここでのneedsLoad判定は、常にロードするか、より詳細な比較をするかによる。
            // 現状は、伴奏XMLが指定されていればロードを試みる。
            needsLoad = true;
        }


        if (needsLoad && xmlToLoad) {
            console.log(`[OSMDPlayer] ${playbackStyle} XMLをロード中...`);
            try {
                await audioSourceOsmdInstance.load(xmlToLoad);
                audioSourceOsmdInstance.render(); // ロード後にレンダリング
                console.log(`[OSMDPlayer] ${playbackStyle} XMLのロード完了。`);
            } catch (error) {
                console.error(`[OSMDPlayer] ${playbackStyle} XMLのロード失敗:`, error);
                alert(`${playbackStyle} XMLのロード失敗`);
                return; // 再生に進まない
            }
        } else if (audioSourceOsmdInstance === osmd.current && (!audioSourceOsmdInstance.Sheet || !audioSourceOsmdInstance.Sheet.SourceMeasures || audioSourceOsmdInstance.Sheet.SourceMeasures.length === 0)) {
             // メインOSMDを使用するモードで、楽譜がロードされていないか空の場合
             console.error("[OSMDPlayer] メイン楽譜がロードされていないか、内容が空です。");
             alert("メイン楽譜がロードされていないか、内容が空です。");
             return;
        }

        // 再生開始前にカーソルをリセット
        audioSourceOsmdInstance.cursor.reset();
        // 表示用OSMDが異なる場合はそちらもリセット
        if (osmd.current && osmd.current.cursor && osmd.current !== audioSourceOsmdInstance) {
            osmd.current.cursor.reset();
        }

        setIsPlaying(true); // 再生中ステートをtrueに設定
        console.log("[OSMDPlayer] playOSMDByCursor: setIsPlaying(true), calling executePlaybackLoop.");
        await executePlaybackLoop(audioSourceOsmdInstance, isAudioSourceDisplay); // 再生ループを開始

    }, [ // useCallbackの依存配列
        osmd, playbackStyle, accompanimentXml, executePlaybackLoop, isPlaybackOsmdReady, isPlaying
    ]);

    // handlePlayPause: 再生/停止ボタンのクリックイベントハンドラ
    const handlePlayPause = useCallback(() => {
        console.log("[OSMDPlayer] handlePlayPause called. isPlayingRef.current:", isPlayingRef.current);
        if (isPlayingRef.current) { // 再生中なら停止
            stopPlaybackRef.current(true); // 最新のstopPlaybackCallbackを呼び出す
        } else { // 停止中なら再生開始
            playOSMDByCursor();
        }
    }, [playOSMDByCursor]); // playOSMDByCursorが変更されたら再生成

    // togglePlaybackStyle: 再生スタイルを切り替える
    const togglePlaybackStyle = useCallback(() => {
        setPlaybackStyle(prevStyle => {
            if (prevStyle === 'score') return 'metronome';
            if (prevStyle === 'metronome') return accompanimentXml ? 'accompaniment' : 'score'; // 伴奏XMLがあれば伴奏モードへ
            if (prevStyle === 'accompaniment') return 'score';
            return 'score'; // デフォルト
        });
    }, [accompanimentXml]); // accompanimentXmlの有無によって動作が変わるため依存配列に追加

    // getPlaybackStyleButtonContent: 再生スタイルボタンの表示内容 (アイコンとテキスト) を取得
    const getPlaybackStyleButtonContent = (
        style: PlaybackStyle,
        accompanimentXmlProvided: boolean // 伴奏XMLが提供されているかどうか
    ): { icon: JSX.Element; text: string } => {
        switch (style) {
            case 'score':
                return { icon: <MdQueueMusic size="1.2em" />, text: "楽譜通り" };
            case 'metronome':
                return { icon: <TbMetronome size="1.2em" />, text: "メトロノーム" };
            case 'accompaniment':
                // 伴奏XMLがあればピアノアイコン、なければデフォルトアイコン
                return { icon: accompanimentXmlProvided ? <LuPiano size="1.2em" /> : <IoMusicalNotesOutline size="1.2em" />, text: accompanimentXmlProvided ? "伴奏" : "楽譜通り" };
            default:
                return { icon: <IoMusicalNotesOutline size="1.2em" />, text: "スタイル切替" };
        }
    };

    // buttonContent: 現在の再生スタイルに応じたボタン表示内容
    const buttonContent = getPlaybackStyleButtonContent(playbackStyle, !!accompanimentXml);

    // --- JSX (コンポーネントのレンダリング部分) ---
    return (
        <div>
            {/* 伴奏譜面再生用の非表示OSMDコンテナ */}
            <div
                ref={playbackOsmdContainerRef}
                style={{
                    position: 'absolute', left: '-9999px', top: '-9999px', // 画面外に配置して非表示にする
                    width: '1px', height: '1px', overflow: 'hidden'
                }}
            />

            {/* BPM調整ボタン */}
            <button onClick={() => {handlebpmChange(false)}}> ＜＜</button>
            <span style={{ display: 'inline-block', minWidth: '4em', textAlign: 'center' }}>{getCurrentBpm()}bpm</span>
            <button onClick={() => {handlebpmChange(true)}}> ＞＞</button>

            {/* 再生/停止ボタン */}
            <button
                onClick={handlePlayPause}
                style={{ marginLeft: '5px' }}
                disabled={ // 特定の条件下でボタンを無効化
                    // メインOSMDが未準備 (ただし伴奏モードで伴奏OSMDが準備完了かつ伴奏XMLがある場合は除く)
                    (!osmd.current && !(playbackStyle === 'accompaniment' && isPlaybackOsmdReady && accompanimentXml)) ||
                    // 伴奏モード選択時、伴奏OSMDが未準備または伴奏XMLがない場合
                    (playbackStyle === 'accompaniment' && (!isPlaybackOsmdReady || !accompanimentXml))
                }
            >
                {isPlaying ? "⏹️ 停止" : "▶️ 再生"}
            </button>

            {/* 次へ/前へボタン (手動でカーソル移動) */}
            <button style={{ marginLeft: '10px' }} onClick={() => {
                const audioSrc = (playbackStyle === 'accompaniment' && playbackOsmdRef.current && accompanimentXml) ? playbackOsmdRef.current : osmd.current;
                const display = osmd.current;
                if(audioSrc?.cursor?.iterator) audioSrc.cursor.next();
                if(display && display !== audioSrc && display.cursor?.iterator) display.cursor.next(); // 表示用も進める (ソースが異なる場合のみ)
                if(display?.cursor?.iterator?.CurrentMeasure) { // 表示OSMDの現在小節へスクロール
                    onRequestScrollToMeasure(display.cursor.iterator.CurrentMeasure.MeasureNumber,true);
                }
            }} disabled={/* (再生ボタンと同様のdisabled条件) */ (!osmd.current && !(playbackStyle === 'accompaniment' && isPlaybackOsmdReady && accompanimentXml)) || (playbackStyle === 'accompaniment' && (!isPlaybackOsmdReady || !accompanimentXml))}>次へ</button>
            <button onClick={() => {
                 const audioSrc = (playbackStyle === 'accompaniment' && playbackOsmdRef.current && accompanimentXml) ? playbackOsmdRef.current : osmd.current;
                 const display = osmd.current;
                 if(audioSrc?.cursor?.iterator) audioSrc.cursor.previous();
                 if(display && display !== audioSrc && display.cursor?.iterator) display.cursor.previous(); // 表示用も戻す
                 if(display?.cursor?.iterator?.CurrentMeasure) {
                    onRequestScrollToMeasure(display.cursor.iterator.CurrentMeasure.MeasureNumber , true);
                }
            }} disabled={/* (再生ボタンと同様のdisabled条件) */ (!osmd.current && !(playbackStyle === 'accompaniment' && isPlaybackOsmdReady && accompanimentXml)) || (playbackStyle === 'accompaniment' && (!isPlaybackOsmdReady || !accompanimentXml))}>前へ</button>

            {/* 習熟度ランダム更新ボタン */}
            <button style={{ marginLeft: '10px' }} onClick={() => onProficiencyUpdate(getDummyProficiency())}>習熟度ランダム</button>
            {/* 難易度調整ボタン */}
            <button style={{ marginLeft: '10px' }} onClick={() => onDifficultyChange(Math.max(0, difficulty - 1) as Difficulty)} disabled={difficulty === 0}> ＜ </button>
            <span style={{ display: 'inline-block', minWidth: '3em', textAlign: 'center' }}>{difficulty === 0 ? "auto" : `Lv ${difficulty}`}</span>
            <button onClick={() => onDifficultyChange(Math.min(5, difficulty + 1) as Difficulty)} disabled={difficulty === 5}> ＞ </button>

            {/* 下段のコントロールボタン */}
            <div style={{ marginTop: '10px' }}>
                {/* 録音ON/OFFボタン */}
                <button onClick={() => setIsRecordingEnabled(!isRecordingEnabled)} style={{ marginRight: '10px' }}>
                    録音: {isRecordingEnabled ? "ON" : "OFF"}
                </button>
                {/* 再生スタイル切り替えボタン */}
                <button
                    onClick={togglePlaybackStyle}
                    title="再生方法を切り替えます"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3em' }}
                    // メトロノームモードで伴奏XMLがない場合は、伴奏モードへの切り替えを無効化する意図 (ただし現状のtoggleロジックでは直接伴奏にはいかない)
                    disabled={playbackStyle === 'metronome' && !accompanimentXml}
                >
                    {buttonContent.icon}
                    {buttonContent.text}
                </button>
            </div>
        </div>
    );
}