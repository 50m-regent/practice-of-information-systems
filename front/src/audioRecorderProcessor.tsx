import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    OpenSheetMusicDisplay,
    VoiceEntry,
    Note,
    Cursor,
    SourceMeasure, // 小節のデュレーション取得に必要
    Fraction // OSMDの音楽的時間単位 (Fraction) を扱う可能性があれば
} from 'opensheetmusicdisplay';
import { Difficulty } from './types/types'; // types.ts がプロジェクト内に存在すると仮定
import { IoMusicalNotesOutline } from 'react-icons/io5';
import { MdQueueMusic } from "react-icons/md";
import { LuPiano } from "react-icons/lu";
import { TbMetronome } from 'react-icons/tb';

interface OSMDPlayerProps {
  osmd: React.RefObject<OpenSheetMusicDisplay>; // 表示用OSMD
  difficulty: Difficulty;
  accompanimentXml?: string | null;
  basebpm: number;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onProficiencyUpdate: (newProficiency: number) => void;
  onRequestScrollToMeasure: (measureNumber: number, smooth?: boolean) => void;
}

type PlaybackStyle = 'score' | 'metronome' | 'accompaniment';

const getDummyProficiency = (): number => {
    return Math.floor(Math.random() * 10) + 1;
};

export function OSMDPlayer({
    osmd,
    difficulty,
    accompanimentXml,
    basebpm,
    onDifficultyChange,
    onProficiencyUpdate,
    onRequestScrollToMeasure,
}: OSMDPlayerProps) {

    // --- 全体の再生状態 ---
    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useRef(isPlaying);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    // --- BPM関連 ---
    const [currentBpmRato, setCurrentBpmRato] = useState<number>(0);
    const getCurrentBpm = useCallback(() => basebpm + currentBpmRato, [basebpm, currentBpmRato]);
    const handlebpmChange = useCallback((doUp : boolean) => {
        if(doUp) setCurrentBpmRato(prev => prev + 10);
        else setCurrentBpmRato(prev => Math.max(prev - 10, 10 - basebpm));
    }, [basebpm]);

    // --- AudioContext参照 ---
    const mainAudioContextRef = useRef<AudioContext | null>(null); // 「楽譜通り」「メトロノーム」用
    const accompanimentAudioContextRef = useRef<AudioContext | null>(null); // 「伴奏」用

    // --- 表示用カーソルループ関連 ---
    const displayLoopTimerIdRef = useRef<number | null>(null);
    const displayLoopStoppedRef = useRef(true);

    // --- 伴奏再生ループ関連 ---
    const accompanimentLoopTimerIdRef = useRef<number | null>(null);
    const accompanimentLoopStoppedRef = useRef(true);
    const playbackOsmdContainerRef = useRef<HTMLDivElement>(null);
    const playbackOsmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const [isPlaybackOsmdReady, setIsPlaybackOsmdReady] = useState(false);

    // --- 「楽譜通り」再生用ループ関連 ---
    const scoreAudioLoopTimerIdRef = useRef<number | null>(null);
    const scoreAudioLoopStoppedRef = useRef(true);

    // --- 録音関連 (MediaRecorderベース) ---
    const [isRecordingEnabled, setIsRecordingEnabled] = useState(true);
    const isRecordingEnabledRef = useRef(isRecordingEnabled);
    useEffect(() => { isRecordingEnabledRef.current = isRecordingEnabled; }, [isRecordingEnabled]);

    const [isActuallyRecording, setIsActuallyRecording] = useState(false);
    const isActuallyRecordingRef = useRef(isActuallyRecording);
    useEffect(() => { isActuallyRecordingRef.current = isActuallyRecording; }, [isActuallyRecording]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const currentMeasureForRecordingRef = useRef<number>(1);

    // --- 再生スタイル ---
    const [playbackStyle, setPlaybackStyle] = useState<PlaybackStyle>('score');

    // --- 初期化 ---
    useEffect(() => {
        if (playbackOsmdContainerRef.current && !playbackOsmdRef.current) {
            try {
                const instance = new OpenSheetMusicDisplay(playbackOsmdContainerRef.current, {
                    autoResize: false, backend: "svg", drawTitle: false, drawSubtitle: false,
                    drawComposer: false, drawLyricist: false, drawMetronomeMarks: false,
                    drawPartNames: false, drawMeasureNumbers: false,
                });
                playbackOsmdRef.current = instance;
                setIsPlaybackOsmdReady(true);
            } catch (error) { console.error("Failed to init playback OSMD:", error); }
        }
    }, []);

    // --- ヘルパー関数 ---
    const getNoteDurationMs = useCallback((realValueInQuarterNotes: number, bpm: number): number => {
        if (bpm <= 0) return 500; // BPMが0以下ならデフォルトの短い時間を返す
        return realValueInQuarterNotes * (60000 / bpm);
    }, []);
    const midiNoteNumberToFrequency = useCallback((midiNoteNumber: number): number => 440 * Math.pow(2, (midiNoteNumber - 69) / 12), []);

    const playBeepGeneric = useCallback((audioCtx: AudioContext | null, frequency: number, durationMs: number) => {
        if (!audioCtx || audioCtx.state === 'closed') {
            console.warn("[OSMDPlayer] playBeepGeneric: AudioContext not available or closed.");
            return;
        }
        try {
            const oscillator = audioCtx.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
            oscillator.connect(audioCtx.destination);
            oscillator.start();
            // durationMsが非常に短い、または0以下の場合の対策
            const stopTime = audioCtx.currentTime + Math.max(0.01, durationMs / 1000);
            oscillator.stop(stopTime);
        } catch (e) { console.error("[OSMDPlayer] playBeepGeneric error:", e); }
    }, []);

    // --- 録音関数 ---
    const startActualRecording = useCallback(async () => {
        if (isActuallyRecordingRef.current || !isRecordingEnabledRef.current) return;
        console.log("[OSMDPlayer] Starting actual recording...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mr = new MediaRecorder(stream);
            mediaRecorderRef.current = mr;
            audioChunksRef.current = [];
            mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mr.onerror = (e) => console.error("MediaRecorder error:", e);
            mr.start(); // 連続録音
            setIsActuallyRecording(true);
        } catch (err) {
            console.error('Mic record start failed:', err);
            setIsActuallyRecording(false); // 失敗したらフラグを戻す
        }
    }, []);

    const stopActualSendRecording = useCallback(async (measureNumber: number) => {
        const mr = mediaRecorderRef.current;
        console.log("[OSMDPlayer] Attempting to stop actual recording for measure:", measureNumber, "Current MediaRecorder state:", mr?.state);
        if (!mr || mr.state === 'inactive') {
            console.log("[OSMDPlayer] No active MediaRecorder to stop or already inactive.");
            if(isActuallyRecordingRef.current) setIsActuallyRecording(false); // 状態がズレていれば修正
            return Promise.resolve(); // 何もせず解決
        }

        return new Promise<void>((resolve, reject) => {
            mr.onstop = () => {
                console.log("[OSMDPlayer] MediaRecorder.onstop triggered for measure:", measureNumber);
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];
                if (isRecordingEnabledRef.current && audioBlob.size > 0) {
                    console.log("[OSMDPlayer] Updating proficiency for measure:", measureNumber);
                    onProficiencyUpdate(getDummyProficiency());
                }
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                mediaRecorderRef.current = null;
                setIsActuallyRecording(false);
                resolve();
            };
            mr.onerror = (event: Event) => {
                console.error("[OSMDPlayer] MediaRecorder.onerror on stop:", event);
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                mediaRecorderRef.current = null;
                setIsActuallyRecording(false);
                reject(new Error("MediaRecorder error on stop: " + (event.type || "Unknown error")));
            };

            if (mr.state === 'recording' || mr.state === 'paused') {
                console.log("[OSMDPlayer] Calling MediaRecorder.stop()");
                mr.stop();
            } else {
                console.warn("[OSMDPlayer] MediaRecorder was not in 'recording' or 'paused' state. State:", mr.state);
                resolve(); // onstopは発火しない可能性があるので、ここでresolve
            }
        });
    }, [onProficiencyUpdate]);


    // --- 表示用カーソルループ ---
    const runDisplayCursorLoop = useCallback(async (osmdInstance: OpenSheetMusicDisplay, bpm: number) => {
        if (!osmdInstance.cursor || !osmdInstance.Sheet) {
            console.error("[DisplayLoop] OSMD instance, cursor, or sheet not available.");
            return;
        }
        console.log("[DisplayLoop] Starting display cursor loop.");
        displayLoopStoppedRef.current = false;
        const cursor = osmdInstance.cursor;

        if (!cursor.iterator) osmdInstance.Sheet.resetIterators();
        if (cursor.iterator.endReached) cursor.reset();
        cursor.show();

        const initialMeasure = cursor.iterator.CurrentMeasure;
        if (initialMeasure) {
            onRequestScrollToMeasure(initialMeasure.MeasureNumber, false);
            currentMeasureForRecordingRef.current = initialMeasure.MeasureNumber;
        } else {
            currentMeasureForRecordingRef.current = 1; // フォールバック
        }
        
        if (isRecordingEnabledRef.current && !isActuallyRecordingRef.current) {
            await startActualRecording().catch(e => console.error("Error starting initial recording:", e));
        }

        const stepDisplay = async () => {
            if (displayLoopStoppedRef.current || !isPlayingRef.current) {
                console.log("[DisplayLoop] Stopping. displayStoppedRef:", displayLoopStoppedRef.current, "isPlayingRef:", isPlayingRef.current);
                // cursor.hide();
                if (isActuallyRecordingRef.current) {
                    await stopActualSendRecording(currentMeasureForRecordingRef.current).catch(e=>console.error("Error stopping recording on display loop stop:", e));
                }
                return;
            }

            if (cursor.iterator.endReached) {
                console.log("[DisplayLoop] End reached.");
                if (isActuallyRecordingRef.current) {
                    await stopActualSendRecording(currentMeasureForRecordingRef.current).catch(e=>console.error("Error stopping recording on end reached:", e));
                }
                cursor.reset(); // ループ再生のためにリセット
                currentMeasureForRecordingRef.current = cursor.iterator.CurrentMeasure?.MeasureNumber ?? 1;
                if (isRecordingEnabledRef.current && !isActuallyRecordingRef.current && isPlayingRef.current) {
                     await startActualRecording().catch(e => console.error("Error restarting recording on loop:", e));
                }
                 // ここで再生を完全に停止させたい場合は setIsPlaying(false) を呼ぶ
            }

            const voiceEntries = cursor.iterator.CurrentVisibleVoiceEntries;
            let durationMs = 100;
            let notesFoundInStep = false;

            if (Array.isArray(voiceEntries) && voiceEntries.length > 0) {
                const noteDurations = voiceEntries.flatMap(entry =>
                    entry.Notes.map(note => note.Length.RealValue)
                ).filter(d => d > 0);
                if (noteDurations.length > 0) {
                    durationMs = getNoteDurationMs(Math.max(...noteDurations), bpm);
                    notesFoundInStep = true;
                }
            }

            if (!notesFoundInStep) {
                const currentMeasure = cursor.iterator.CurrentMeasure as SourceMeasure;
                if (currentMeasure?.Duration) {
                    durationMs = getNoteDurationMs(currentMeasure.Duration.RealValue, bpm);
                    if (durationMs <= 0) durationMs = Math.max(10, (60000 / bpm) * 0.5); // 最小でも半拍程度は待つ
                    console.log(`[DisplayLoop] No notes in step (measure ${currentMeasure.MeasureNumber}), using measure duration: ${durationMs}ms`);
                } else {
                    durationMs = Math.max(10, (60000 / bpm) * 0.5); // フォールバック
                    console.log(`[DisplayLoop] No notes and no measure duration, fallback wait ${durationMs}ms`);
                }
            }
            
            const currentDisplayMeasureNum = cursor.iterator.CurrentMeasure?.MeasureNumber ?? 0;
            if (currentDisplayMeasureNum !== currentMeasureForRecordingRef.current && currentDisplayMeasureNum > 0) {
                console.log(`[DisplayLoop] Measure changed from ${currentMeasureForRecordingRef.current} to ${currentDisplayMeasureNum}`);
                if (isActuallyRecordingRef.current) {
                    await stopActualSendRecording(currentMeasureForRecordingRef.current).catch(e=>console.error("Error stopping recording on measure change:", e));
                }
                currentMeasureForRecordingRef.current = currentDisplayMeasureNum;
                if (isRecordingEnabledRef.current && !isActuallyRecordingRef.current && isPlayingRef.current) {
                    await startActualRecording().catch(e => console.error("Error starting recording on measure change:", e));
                }
            }
            if (currentDisplayMeasureNum > 0) {
                onRequestScrollToMeasure(currentDisplayMeasureNum, true);
            }

            if (playbackStyle === 'metronome' && mainAudioContextRef.current) {
                 // 実際の拍の頭で鳴らすには、より精密なタイミング計算が必要
                 // ここでは簡略化のため、各ステップの開始時に1回だけ鳴らす（要改善）
                 playBeepGeneric(mainAudioContextRef.current, 880, 50);
            }

            displayLoopTimerIdRef.current = window.setTimeout(() => {
                if (!displayLoopStoppedRef.current && isPlayingRef.current) {
                    cursor.next();
                    stepDisplay();
                }
            }, Math.max(10, durationMs));
        };
        stepDisplay();
    }, [osmd, getCurrentBpm, onRequestScrollToMeasure, getNoteDurationMs, startActualRecording, stopActualSendRecording, playbackStyle, playBeepGeneric]);

    const stopDisplayCursorLoop = useCallback(() => {
        console.log("[DisplayLoop] Explicit stop called.");
        displayLoopStoppedRef.current = true;
        if (displayLoopTimerIdRef.current !== null) {
            clearTimeout(displayLoopTimerIdRef.current);
            displayLoopTimerIdRef.current = null;
        }
        osmd.current?.cursor.hide();
    }, [osmd]);


    // --- 汎用オーディオループ (楽譜通り再生と伴奏再生で使用) ---
    const runGenericAudioLoop = useCallback(async (
        targetOsmd: OpenSheetMusicDisplay,
        audioCtx: AudioContext, // 使用するAudioContextを引数で受け取る
        loopStoppedFlag: React.MutableRefObject<boolean>,
        timerIdRefToUse: React.MutableRefObject<number | null>,
        loopMusicClipRef: React.MutableRefObject<[number,number][]>, // 音楽クリップ記録用
        bpm: number,
        xmlToLoadIfAny?: string | null // 伴奏の場合など、必要に応じてXMLをロード
    ) => {
        if (!targetOsmd) return;
        const loopType = targetOsmd === osmd.current ? 'ScoreAudio' : 'Accompaniment';
        console.log(`[${loopType}Loop] Starting.`);
        loopStoppedFlag.current = false;
        loopMusicClipRef.current = []; // ループ開始時にクリップをリセット

        if (xmlToLoadIfAny && targetOsmd.Sheet?.SourceXML !== xmlToLoadIfAny) { // 簡単な比較
            try {
                console.log(`[${loopType}Loop] Loading XML.`);
                await targetOsmd.load(xmlToLoadIfAny);
                targetOsmd.render();
            } catch (e) {
                console.error(`[${loopType}Loop] Failed to load XML:`, e);
                loopStoppedFlag.current = true; return;
            }
        }
        if (!targetOsmd.Sheet) {
            console.error(`[${loopType}Loop] No sheet loaded.`);
            loopStoppedFlag.current = true; return;
        }

        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const cursor = targetOsmd.cursor;
        if (!cursor.iterator) targetOsmd.Sheet.resetIterators();
        if (cursor.iterator.endReached) cursor.reset();
        // このループではカーソルは表示しない (表示はdisplayLoopに任せる)

        const stepAudio = () => {
            if (loopStoppedFlag.current || !isPlayingRef.current || audioCtx.state === 'closed') {
                console.log(`[${loopType}Loop] Stopping.`);
                return;
            }
            if (cursor.iterator.endReached) {
                console.log(`[${loopType}Loop] End reached. Resetting.`);
                // console.log(`${loopType} Clip:`, JSON.stringify(loopMusicClipRef.current));
                cursor.reset(); // ループ再生
            }

            const voiceEntries = cursor.iterator.CurrentVisibleVoiceEntries;
            let durationMs = 100;
            let notesFoundInStep = false;

            if (Array.isArray(voiceEntries) && voiceEntries.length > 0) {
                const noteDurations = voiceEntries.flatMap(entry =>
                    entry.Notes.map(note => note.Length.RealValue)
                ).filter(d => d > 0);

                if (noteDurations.length > 0) {
                    const maxDuration = Math.max(...noteDurations);
                    durationMs = getNoteDurationMs(maxDuration, bpm);
                    notesFoundInStep = true;

                    voiceEntries.forEach(entry => entry.Notes.forEach(note => {
                        if (note.Pitch) {
                            const freq = midiNoteNumberToFrequency(note.Pitch.halfTone);
                            playBeepGeneric(audioCtx, freq, durationMs);
                            loopMusicClipRef.current.push([freq, durationMs]);
                        } else {
                            // loopMusicClipRef.current.push([0, durationMs]); // 休符も記録する場合
                        }
                    }));
                }
            }
            
            if (!notesFoundInStep) { // ★ 音符がない小節の処理
                const currentMeasure = cursor.iterator.CurrentMeasure as SourceMeasure;
                if (currentMeasure?.Duration) {
                    durationMs = getNoteDurationMs(currentMeasure.Duration.RealValue, bpm);
                    if (durationMs <= 0) durationMs = Math.max(10, (60000 / bpm) * 0.5);
                    // console.log(`[${loopType}Loop] No notes in step (measure ${currentMeasure.MeasureNumber}), using measure duration: ${durationMs}ms`);
                } else {
                    durationMs = Math.max(10, (60000 / bpm) * 0.5);
                    // console.log(`[${loopType}Loop] No notes and no measure duration, fallback wait ${durationMs}ms`);
                }
            }

            timerIdRefToUse.current = window.setTimeout(() => {
                if (!loopStoppedFlag.current && isPlayingRef.current) {
                    cursor.next();
                    stepAudio();
                }
            }, Math.max(10, durationMs));
        };
        stepAudio();
    }, [getNoteDurationMs, midiNoteNumberToFrequency, playBeepGeneric, osmd]); // osmd (main) を依存配列に追加

    const stopGenericAudioLoop = useCallback(async (
        audioCtxRefToClose: React.RefObject<AudioContext | null>,
        loopStoppedFlagToSet: React.MutableRefObject<boolean>,
        timerIdRefToClear: React.MutableRefObject<number | null>
    ) => {
        console.log("[StopGenericLoop] Setting flag to stop loop for ref associated with timer:", timerIdRefToClear.current);
        loopStoppedFlagToSet.current = true;

        if (timerIdRefToClear.current !== null) {
            clearTimeout(timerIdRefToClear.current);
            timerIdRefToClear.current = null;
        }

        if (audioCtxRefToClose && audioCtxRefToClose.current) {
            if (audioCtxRefToClose.current.state !== 'closed') {
                console.log("[StopGenericLoop] Closing AudioContext. State:", audioCtxRefToClose.current.state);
                try {
                    await audioCtxRefToClose.current.close();
                } catch (e) { console.error("[StopGenericLoop] Error closing AudioContext:", e); }
            }
            audioCtxRefToClose.current = null;
        } else {
            console.log("[StopGenericLoop] No active AudioContext to close or ref not properly provided.");
        }
    }, []);


    // --- Play/Pause Handler (修正版) ---
    const handlePlayPause = useCallback(async () => {
        if (isPlayingRef.current) { // --- 停止処理 ---
            console.log("[PlayPause] Stopping all.");
            setIsPlaying(false);

            // 各ループの停止処理
            stopDisplayCursorLoop(); // これはフラグ設定とタイマークリアを行う
            await stopGenericAudioLoop(mainAudioContextRef, scoreAudioLoopStoppedRef, scoreAudioLoopTimerIdRef);
            await stopGenericAudioLoop(accompanimentAudioContextRef, accompanimentLoopStoppedRef, accompanimentLoopTimerIdRef);

            if (isActuallyRecordingRef.current) {
                await stopActualSendRecording(currentMeasureForRecordingRef.current)
                    .catch(e => console.error("Error stopping recording on play/pause:", e));
            }
        } else { // --- 再生処理 ---
            console.log("[PlayPause] Starting all based on playbackStyle:", playbackStyle);
            const bpm = getCurrentBpm();

            // メイン表示OSMDの準備は必須
            if (!osmd.current || !osmd.current.Sheet) {
                alert("表示用の楽譜がロードされていません。");
                return;
            }

            // 表示カーソルループは常に開始
            runDisplayCursorLoop(osmd.current, bpm);

            // 再生スタイルに応じたオーディオループを開始
            if (playbackStyle === 'score') {
                if (!mainAudioContextRef.current || mainAudioContextRef.current.state === 'closed') {
                    mainAudioContextRef.current = new AudioContext();
                }
                if (mainAudioContextRef.current) { // AudioContextが正常に作成/再開されたか確認
                     if (mainAudioContextRef.current.state === 'suspended') await mainAudioContextRef.current.resume();
                     runGenericAudioLoop(osmd, mainAudioContextRef, scoreAudioLoopStoppedRef, scoreAudioLoopTimerIdRef, [], bpm);
                } else {
                    console.error("Failed to initialize main AudioContext for score playback.");
                }
            } else if (playbackStyle === 'accompaniment') {
                if (isPlaybackOsmdReady && playbackOsmdRef.current && accompanimentXml) {
                    if (!accompanimentAudioContextRef.current || accompanimentAudioContextRef.current.state === 'closed') {
                        accompanimentAudioContextRef.current = new AudioContext();
                    }
                    if (accompanimentAudioContextRef.current) { // AudioContextが正常に作成/再開されたか確認
                        if (accompanimentAudioContextRef.current.state === 'suspended') await accompanimentAudioContextRef.current.resume();
                        runGenericAudioLoop(playbackOsmdRef, accompanimentAudioContextRef, accompanimentLoopStoppedRef, accompanimentLoopTimerIdRef, [], bpm, accompanimentXml);
                    } else {
                        console.error("Failed to initialize accompaniment AudioContext.");
                    }
                } else {
                    console.warn("Accompaniment selected, but player/XML not ready.");
                }
            } else if (playbackStyle === 'metronome') {
                // メトロノーム音は runDisplayCursorLoop 内で処理される
                 if (!mainAudioContextRef.current || mainAudioContextRef.current.state === 'closed') {
                    mainAudioContextRef.current = new AudioContext(); // メトロノーム用に必要なら作成
                }
                if (mainAudioContextRef.current?.state === 'suspended') await mainAudioContextRef.current.resume();
                console.log("Metronome style selected. Beeps will be played by display loop.");
            }
            setIsPlaying(true); // 全てのセットアップが終わってから再生状態にする
        }
    }, [
        osmd, playbackOsmdRef, accompanimentXml, isPlaybackOsmdReady, playbackStyle,
        getCurrentBpm, runDisplayCursorLoop, runGenericAudioLoop, stopGenericAudioLoop, stopDisplayCursorLoop,
        stopActualSendRecording 
    ]);

    // --- Unmount Cleanup ---
    const stopAllLoopsForUnmountRef = useRef(async () => { /* ... (変更なし) ... */ });
    useEffect(() => { /* ... (変更なし) ... */ }, [stopActualSendRecording]);
    useEffect(() => { return () => { console.log("[OSMDPlayer] Unmounting."); stopAllLoopsForUnmountRef.current(); }; }, []);


    // --- Playback Style Toggle & Button Content ---
    const togglePlaybackStyle = useCallback(() => {
        setPlaybackStyle(prevStyle => {
            const hasAccompaniment = !!accompanimentXml && isPlaybackOsmdReady;
            if (prevStyle === 'score') return 'metronome';
            if (prevStyle === 'metronome') return hasAccompaniment ? 'accompaniment' : 'score';
            if (prevStyle === 'accompaniment') return 'score';
            return 'score';
        });
    }, [accompanimentXml, isPlaybackOsmdReady]);

    const getPlaybackStyleButtonContent = useCallback((
        style: PlaybackStyle,
        accompanimentXmlProvidedAndReady: boolean
    ): { icon: JSX.Element; text: string } => {
        switch (style) {
            case 'score': return { icon: <MdQueueMusic size="1.2em" />, text: "楽譜通り" };
            case 'metronome': return { icon: <TbMetronome size="1.2em" />, text: "メトロノーム" };
            case 'accompaniment': return { icon: accompanimentXmlProvidedAndReady ? <LuPiano size="1.2em" /> : <IoMusicalNotesOutline size="1.2em" />, text: accompanimentXmlProvidedAndReady ? "伴奏" : "楽譜通り(伴奏無)" };
            default: return { icon: <IoMusicalNotesOutline size="1.2em" />, text: "スタイル切替" };
        }
    }, []);
    const buttonContent = getPlaybackStyleButtonContent(playbackStyle, !!accompanimentXml && isPlaybackOsmdReady);

    return (
        <div>
            <div ref={playbackOsmdContainerRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}/>
            <button onClick={() => handlebpmChange(false)}>BPM ＜＜</button>
            <span style={{ display: 'inline-block', minWidth: '4em', textAlign: 'center', margin: '0 5px' }}>{getCurrentBpm()}bpm</span>
            <button onClick={() => handlebpmChange(true)}>BPM ＞＞</button>
            <button onClick={handlePlayPause} style={{ marginLeft: '10px' }}
                disabled={(!osmd.current?.Sheet && !(playbackStyle === 'accompaniment' && accompanimentXml && isPlaybackOsmdReady))}
            >
                {isPlaying ? "⏹️ 停止" : "▶️ 再生"}
            </button>
            <button style={{ marginLeft: '10px' }} onClick={() => {
                if(osmd.current?.cursor?.iterator) { osmd.current.cursor.next(); if(osmd.current.cursor.iterator.CurrentMeasure) onRequestScrollToMeasure(osmd.current.cursor.iterator.CurrentMeasure.MeasureNumber, true); }
            }} disabled={!osmd.current?.Sheet}>次へ</button>
            <button onClick={() => {
                 if(osmd.current?.cursor?.iterator) { osmd.current.cursor.previous(); if(osmd.current.cursor.iterator.CurrentMeasure) onRequestScrollToMeasure(osmd.current.cursor.iterator.CurrentMeasure.MeasureNumber, true); }
            }} disabled={!osmd.current?.Sheet}>前へ</button>

            <button style={{ marginLeft: '10px' }} onClick={() => onProficiencyUpdate(getDummyProficiency())}>習熟度(仮)</button>
            <button style={{ marginLeft: '10px' }} onClick={() => onDifficultyChange(Math.max(0, difficulty - 1) as Difficulty)} disabled={difficulty === 0}>難易度 ＜</button>
            <span style={{ display: 'inline-block', minWidth: '3em', textAlign: 'center', margin: '0 5px' }}>{difficulty === 0 ? "auto" : `Lv ${difficulty}`}</span>
            <button onClick={() => onDifficultyChange(Math.min(5, difficulty + 1) as Difficulty)} disabled={difficulty === 5}>難易度 ＞</button>

            <div style={{ marginTop: '10px' }}>
                <button onClick={() => setIsRecordingEnabled(!isRecordingEnabled)} style={{ marginRight: '10px' }}>
                    録音: {isRecordingEnabled ? "ON" : "OFF"} {isActuallyRecording ? "(録音中)" : ""}
                </button>
                <button onClick={togglePlaybackStyle} title="再生方法を切り替えます" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3em' }} >
                    {buttonContent.icon} {buttonContent.text}
                </button>
            </div>
        </div>
    );
}