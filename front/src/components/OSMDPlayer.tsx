import React, { useEffect, useRef, useState, useCallback, use } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Difficulty } from '../types/types'; // 型定義ファイルのパスは適宜調整してください

interface OSMDPlayerProps {
  osmd: React.RefObject<OpenSheetMusicDisplay>;
  difficulty: Difficulty;
  accompanimentXml?: string; // 伴奏XMLはオプション
  basebpm: number; // ベースBPMはオプション、デフォルトは120
  onDifficultyChange: (difficulty: Difficulty) => void;
  onProficiencyUpdate: (newProficiency: number) => void;
  getMeasureDifficulty?: (measureNumber: number, difficulty: Difficulty) => Difficulty; // 小節ごとの難易度取得関数
  onRequestScrollToMeasure: (measureNumber: number, smooth?: boolean) => void;
}

type playModeType ='score' | `metronome`; // 再生モードの型定義

// ダミーの習熟度を生成する関数
const getDummyProficiency = async () => {
    return (Math.random() * 10) + 1; // 1から10のランダムな整数
};

export function OSMDPlayer({
    osmd,
    difficulty,
    accompanimentXml,
    basebpm,
    onDifficultyChange,
    onProficiencyUpdate,
    getMeasureDifficulty,
    onRequestScrollToMeasure,
    
}: OSMDPlayerProps) {

    const [isPlaying, setIsPlaying] = useState(false);
    const [playMode, setPlayMode] = useState<playModeType>('score'); // 再生モードの状態管理
    const timerIdRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const [currentBpmRato, setCurrentBpmRato] = useState<number>(0); // デフォルトのBPMは120、必要に応じて変更可能
    const current_bpm = useRef<number>(basebpm); // BPM変更機能がなければ useState でも可

    const musicClipRef = useRef<[number, number][]>([]);
    const measureClipsRef = useRef<[number, number][][]>([]); // 小節ごとの演奏情報を蓄積

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [isRecording, setIsRecording] = useState(false); // 録音中かどうかのUI向け状態
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const currentMeasureForRecordingRef = useRef<number>(1);

    // isPlaying, isRecording の最新値を非同期コールバック内で参照するための Ref
    const isPlayingRef = useRef(isPlaying);
    const isRecordingRef = useRef(isRecording);
    const playModeRef = useRef<playModeType>(playMode);

    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
    useEffect(() => { playModeRef.current = playMode; }, [playMode]);


    const getNoteDurationMs = useCallback((duration: number, bpm: number) => (60 / bpm) * 1000 * duration * 4, []);
    const midiNoteNumberToFrequency = useCallback((midiNoteNumber: number): number => 440 * Math.pow(2, (midiNoteNumber - 69) / 12), []);
    const handlebpmChange = useCallback((doUp : Boolean) => {
        if(doUp) {
            setCurrentBpmRato(currentBpmRato + 10);
        }else if(basebpm + currentBpmRato > 10) {
            setCurrentBpmRato(currentBpmRato - 10);
        }
        // return currentBpmRatoRef.current+basebpm!; // base_bpm が undefined でないことを保証するための非nullアサーション
    }, [currentBpmRato]);
    const getCurrentBpm = useCallback(() => {
        return basebpm + currentBpmRato; // base_bpm が undefined でないことを保証するための非nullアサーション
    }, [basebpm, currentBpmRato]);

    const playBeep = useCallback((frequency: number, durationMs: number) => {
        if (!audioContextRef.current) return;
        const oscillator = audioContextRef.current.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
        oscillator.connect(audioContextRef.current.destination);
        oscillator.start();
        oscillator.stop(audioContextRef.current.currentTime + durationMs / 1000);
    }, []);

    const startRecording = useCallback(async () => {
        if (isRecordingRef.current) { // Ref を使用
            console.log("既に録音中です。"); // "Already recording."
            return;
        }
        try {
            console.log("録音開始を試みています..."); // "Attempting to start recording..."
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            mediaRecorder.start();
            setIsRecording(true); // State を更新 (Ref は useEffect で同期される)
            console.log("録音が正常に開始されました。"); // "Recording started successfully."
        } catch (err) {
            console.error('マイク録音の開始に失敗しました:', err);
            setIsRecording(false);
            // streamRef.current や mediaRecorderRef.current のクリーンアップが必要な場合がある
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            mediaRecorderRef.current = null;
            alert('マイク録音の開始に失敗しました。マイクへのアクセス許可を確認してください。');
            throw err; // 再生処理側でエラーを補足できるように再スローも検討
        }
    }, []); // isRecordingRef は依存配列に含めない (Ref の性質)

    const stopAndSendRecording = useCallback(async (measureNumber: number) => {
        const mediaRecorder = mediaRecorderRef.current;
        // mediaRecorder が存在し、かつ 'inactive' でない場合のみ処理
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            console.log("stopAndSendRecording: MediaRecorderがアクティブでないか、存在しません。"); // "stopAndSendRecording: MediaRecorder not active or not present."
            // 状態が既に 'inactive' でも、関連するUI状態やストリームはクリーンアップした方が良い場合がある
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            mediaRecorderRef.current = null;
            setIsRecording(false);
            return;
        }

        return new Promise<void>((resolve) => {
            mediaRecorder.onstop = async () => {
                console.log(`MediaRecorder.onstop (小節 ${measureNumber})`); // `MediaRecorder.onstop for measure ${measureNumber}`
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = []; // 次の録音のためにクリア

                if (audioBlob.size > 0) {
                    // FormData 準備 (APIはコメントアウト)
                    // const formData = new FormData();
                    // formData.append('audio', audioBlob, `measure${measureNumber}.webm`);
                    // formData.append('measure', String(measureNumber));
                    // const currentClip = measureClipsRef.current.find(clip => clip.measure === measureNumber); // 仮
                    // formData.append('notes', JSON.stringify(currentClip?.notes || []));
                    console.log(`小節 ${measureNumber} の音声が録音されました。サイズ: ${audioBlob.size}。API呼び出しをシミュレートします。`); // `Audio recorded for measure ${measureNumber}, size: ${audioBlob.size}. Simulating API call.`

                    // ★ ダミーの習熟度更新処理
                    const dummyProficiency = getDummyProficiency();
                    console.log(`[OSMDPlayer] ダミーの習熟度を使用: ${dummyProficiency} (小節 ${measureNumber})`); // `[OSMDPlayer] Using dummy proficiency: ${dummyProficiency} for measure ${measureNumber}`
                    onProficiencyUpdate(dummyProficiency);
                } else {
                    console.log(`小節 ${measureNumber} の音声データがありません。習熟度更新をスキップします。`); // `No audio data for measure ${measureNumber}, skipping proficiency update.`
                }

                // ストリームとレコーダーのクリーンアップ
                streamRef.current?.getTracks().forEach(track => track.stop());
                streamRef.current = null;
                mediaRecorderRef.current = null;
                setIsRecording(false);
                resolve();
            };

            // 'recording' 状態の時のみ stop() を呼び出す
            if (mediaRecorder.state === 'recording') {
                console.log("mediaRecorder.stop() を呼び出します..."); // "Calling mediaRecorder.stop()..."
                mediaRecorder.stop();
            } else {
                // 既に停止している場合など、onstop が呼ばれない可能性があるので手動で処理
                console.warn(`MediaRecorder の状態が '${mediaRecorder.state}' であり、'recording' ではありませんでした。手動でクリーンアップを実行します。`); // `MediaRecorder state was '${mediaRecorder.state}', not 'recording'. Manually triggering cleanup.`
                // mediaRecorder.onstop を直接呼び出すのは通常行わない。代わりにクリーンアップ処理をここに書くか、onstop内のロジックを共通化する
                streamRef.current?.getTracks().forEach(track => track.stop());
                streamRef.current = null;
                mediaRecorderRef.current = null;
                setIsRecording(false);
                resolve();
            }
        });
    }, [onProficiencyUpdate]); // isRecordingRef は依存配列に含めない

    const stopPlayback = useCallback(async (triggeredByPlayPause = false) => {
        // isPlayingRef.current を使って最新の再生状態を確認
        if (!isPlayingRef.current && !triggeredByPlayPause) {
            console.log("stopPlayback: 再生中でなく、ボタンによるトリガーでもありません。"); // "stopPlayback: Not playing and not triggered by button."
            return;
        }
        console.log("再生を停止しています..."); // "Stopping playback..."
        setIsPlaying(false); // State更新 -> isPlayingRef は useEffect で更新される

        if (timerIdRef.current !== null) {
            clearTimeout(timerIdRef.current);
            timerIdRef.current = null;
        }
        if (audioContextRef.current) {
            try {
                await audioContextRef.current.close();
                console.log("AudioContext がクローズされました。"); // "AudioContext closed."
            } catch (e) {
                console.error("AudioContext クローズエラー:", e); // "AudioContext close error:", e
            }
            audioContextRef.current = null;
        }

        if (isRecordingRef.current) { // isRecordingRef で最新の状態を確認
            console.log("再生が停止しました。録音も停止します..."); // "Playback stopped, stopping recording as well..."
            await stopAndSendRecording(currentMeasureForRecordingRef.current);
        }
        osmd.current?.cursor.hide(); // 停止時はカーソルを隠す
    }, [osmd, stopAndSendRecording]); // isPlayingRef, isRecordingRef は依存配列に含めない


    const playOSMDByCursor = useCallback(async (bpm: number) => {
        const currentOSMD = osmd.current;
        if (!currentOSMD || isPlayingRef.current) { // isPlayingRef を使用
            console.log("playOSMDByCursor: OSMDが準備できていないか、既に再生中です。"); // "playOSMDByCursor: OSMD not ready or already playing."
            return;
        }

        const cursor = currentOSMD.cursor;
        if (cursor.iterator.EndReached) {
            console.log("カーソルが末尾に到達しました。リセットします。"); // "Cursor at end, resetting."
            cursor.reset();
        }
        cursor.show();

        if (audioContextRef.current) {
            await audioContextRef.current.close().catch(e => console.warn("以前のAudioContextのクローズ中にエラーが発生しました:", e)); // "Error closing previous AudioContext:", e
        }
        try {
            audioContextRef.current = new AudioContext();
            console.log("AudioContext が作成/再作成されました。"); // "AudioContext created/recreated."
        } catch (e) {
            console.error("AudioContext の作成に失敗しました:", e); // "Failed to create AudioContext:", e
            alert("AudioContextの作成に失敗しました。");
            return;
        }

        measureClipsRef.current = []; // 新しい再生のためにクリア
        currentMeasureForRecordingRef.current = cursor.iterator.CurrentMeasure?.MeasureNumber ?? 1;

        try {
            await startRecording(); // 録音開始を待つ
        } catch (e) {
            console.warn("録音の開始に失敗しました。録音なしで再生を続行します。"); // "Recording failed to start, playback will continue without recording."
            // 録音に失敗しても再生は続ける
        }
        musicClipRef.current = []; // 現在の小節のクリップをリセット
        setIsPlaying(true); // State更新 -> isPlayingRef は useEffect で更新される

        const step = async () => {
            if (!isPlayingRef.current || !audioContextRef.current) {
                console.log("Step: 再生が停止したか、AudioContext が失われました。"); // "Step: Playback stopped or AudioContext lost."
                if (isRecordingRef.current) await stopAndSendRecording(currentMeasureForRecordingRef.current);
                return;
            }

            const currentMeasureNum = cursor.iterator.CurrentMeasure?.MeasureNumber ?? 0;

            if (cursor.iterator.EndReached) {
                console.log("Step: 楽譜の末尾に到達しました。"); // "Step: End of sheet reached."
                if (musicClipRef.current.length > 0) { // 最後のクリップがあれば保存
                    measureClipsRef.current.push([...musicClipRef.current]);
                }
                if (isRecordingRef.current) await stopAndSendRecording(currentMeasureNum);
                cursor.reset();
                setIsPlaying(false);
                return;
            }

            const voiceEntries = cursor.iterator.CurrentVisibleVoiceEntries; // プロパティ
            let durationMs = 100; // デフォルトの最小待機時間

            if (voiceEntries && voiceEntries.length > 0) {
                const noteDurations = voiceEntries.flatMap(entry =>
                    entry.Notes.map(note => note.Length.RealValue)
                ).filter(val => typeof val === 'number' && !isNaN(val) && val > 0);

                if (noteDurations.length > 0) {
                    const duration = Math.max(...noteDurations);
                    durationMs = getNoteDurationMs(duration, bpm);

                    voiceEntries[0].Notes.forEach(note => {
                        if (note.Pitch && typeof note.Pitch.getHalfTone === 'function') {
                            const freq = midiNoteNumberToFrequency(note.Pitch.getHalfTone());
                            playBeep(freq, durationMs);
                            musicClipRef.current.push([freq, durationMs]);
                        } else { // 休符など
                            musicClipRef.current.push([0, durationMs]);
                        }
                    });
                } else {
                    // 有効な音価を持つ音符がない場合 (例: 装飾音符のみ、またはエラー)
                    durationMs = 50; // 短い遅延
                }
            } else {
                // 音符エントリがない場合 (例: 小節の冒頭でカーソルがまだ音符上にないなど)
                durationMs = 50; // 短い遅延で次に進む
            }

            cursor.next();
            const nextMeasureNum = cursor.iterator.CurrentMeasure?.MeasureNumber ?? 0;

            if (nextMeasureNum !== currentMeasureNum && !cursor.iterator.EndReached) {
                console.log(`Step: 小節が ${currentMeasureNum} から ${nextMeasureNum} に変更されました。`); // `Step: Measure changed from ${currentMeasureNum} to ${nextMeasureNum}`
                if (musicClipRef.current.length > 0) {
                    measureClipsRef.current.push([...musicClipRef.current]);
                }
                if (isRecordingRef.current) await stopAndSendRecording(currentMeasureNum);

                if (isPlayingRef.current) { // 再生が続いていれば
                    musicClipRef.current = []; // 新しい小節のためにリセット
                    currentMeasureForRecordingRef.current = nextMeasureNum;
                    if (isRecordingRef.current) await startRecording(); // 録音を再開
                } else {
                    return; // 再生が停止していたらループ終了
                }
            }

            if (isPlayingRef.current) {
                 timerIdRef.current = window.setTimeout(step, Math.max(10, durationMs)); // 非常に短い音価でも最低10msは待つ
            } else {
                if (isRecordingRef.current) await stopAndSendRecording(currentMeasureForRecordingRef.current);
            }
        };
        step();
    }, [osmd, startRecording, stopAndSendRecording, getNoteDurationMs, midiNoteNumberToFrequency, playBeep]);

    const handlePlayPause = useCallback(() => {
        if (isPlayingRef.current) { // Ref を使用して最新の状態を判断
            stopPlayback(true);
        } else {
            playOSMDByCursor(basebpm); // current_bpm.current を使う場合
        }
    }, [stopPlayback, playOSMDByCursor]); // playOSMDByCursor も依存配列に

    useEffect(() => {
        // コンポーネントのアンマウント時に再生と録音を確実に停止
        return () => {
            console.log("OSMDPlayer アンマウント中。再生と録音を停止します。"); // "OSMDPlayer unmounting. Stopping playback and recording."
            // isPlaying, isRecording の state を直接参照すると古い値の可能性があるため Ref を使用
            setIsPlaying(false); // 先にstateを更新してisPlayingRefの更新をトリガー
            setIsRecording(false); // 同上

            if (timerIdRef.current !== null) clearTimeout(timerIdRef.current);
            if (audioContextRef.current) audioContextRef.current.close().catch(e => console.error("アンマウント: AudioContext クローズエラー:", e)); // "Unmount: AudioContext close error:", e

            const mediaRecorder = mediaRecorderRef.current;
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop(); // onstop が呼ばれることを期待
            }
            streamRef.current?.getTracks().forEach(track => track.stop());
        };
    }, []); // アンマウント時のみ実行

    return (
        // JSX部分は変更なし
        <div>
            <button onClick={() => {handlebpmChange(false)}}> ＜＜</button>
            <span style={{ display: 'inline-block', minWidth: '3em', textAlign: 'center' }}>
                {getCurrentBpm()}bpm
            </span>
            <button onClick={() => {handlebpmChange(true)}}> ＞＞</button>
            <button onClick={handlePlayPause}>
                {isPlaying ? "⏹️ 停止" : "▶️ 再生"}
            </button>
            <button onClick={() => {osmd.current.cursor.next(); onRequestScrollToMeasure(osmd.current.cursor.iterator.CurrentMeasure?.MeasureNumber);console.log(osmd.current.cursor.iterator)}}>次へ</button>
            <button onClick={() => {osmd.current.cursor.previous(); onRequestScrollToMeasure(osmd.current.cursor.iterator.CurrentMeasure?.MeasureNumber)}}>前へ</button>
            <button onClick={() => {onProficiencyUpdate(getDummyProficiency())}}>習熟度ランダム</button>
            <button onClick={() => onDifficultyChange(Math.max(0, difficulty - 1) as Difficulty)} disabled={difficulty === 0}> ＜ </button>
            <span style={{ display: 'inline-block', minWidth: '3em', textAlign: 'center' }}>
                {difficulty === 0 ? "auto" : ` ${difficulty} `}
            </span>
            <button onClick={() => onDifficultyChange(Math.min(5, difficulty + 1) as Difficulty)} disabled={difficulty === 5}> ＞ </button>
        </div>
    );
}