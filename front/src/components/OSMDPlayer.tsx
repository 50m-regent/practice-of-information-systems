import React, { useEffect, useRef, useState, useCallback } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Difficulty } from '../types/types';
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
    const mainAudioContextRef = useRef<AudioContext | null>(null);
    const accompanimentAudioContextRef = useRef<AudioContext | null>(null);

    // --- 表示用カーソルループ関連 ---
    const displayTimerIdRef = useRef<number | null>(null);
    const displayStoppedRef = useRef(true);

    // --- 伴奏/楽譜通り再生ループ関連 ---
    const accompanimentTimerIdRef = useRef<number | null>(null);
    const accompanimentStoppedRef = useRef(true);
    const playbackOsmdContainerRef = useRef<HTMLDivElement>(null);
    const playbackOsmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const [isPlaybackOsmdReady, setIsPlaybackOsmdReady] = useState(false);

    const scoreAudioStoppedRef = useRef(true);

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

    const musicClipRef = useRef<[number, number][]>([]);

    // --- playbackOsmdRef の初期化と accompanimentXml のロード ---
    useEffect(() => {
        if (playbackOsmdContainerRef.current) {
            if (!playbackOsmdRef.current) {
                try {
                    console.log("[OSMDPlayer] Initializing playbackOSMD instance.");
                    playbackOsmdRef.current = new OpenSheetMusicDisplay(playbackOsmdContainerRef.current, {
                        autoResize: false, backend: "svg", drawTitle: false, drawSubtitle: false,
                        drawComposer: false, drawLyricist: false, drawMetronomeMarks: false,
                        drawPartNames: false, drawMeasureNumbers: false,
                    });
                } catch (error) {
                    console.error("[OSMDPlayer] Failed to init playback OSMD instance:", error);
                    setIsPlaybackOsmdReady(false);
                    return;
                }
            }

            if (playbackOsmdRef.current && accompanimentXml) {
                console.log("[OSMDPlayer] Loading accompanimentXml into playbackOSMD.");
                setIsPlaybackOsmdReady(false);
                playbackOsmdRef.current.load(accompanimentXml)
                    .then(() => {
                        console.log("[OSMDPlayer] Accompaniment XML loaded promise resolved.");
                        if (playbackOsmdRef.current) {
                            playbackOsmdRef.current.render();
                            setTimeout(() => {
                                if (playbackOsmdRef.current && playbackOsmdRef.current.cursor) {
                                    console.log("[OSMDPlayer] Cursor is available for accompaniment after render and delay.");
                                    setIsPlaybackOsmdReady(true);
                                } else {
                                    console.error("[OSMDPlayer] Cursor still null or unavailable after load, render, and delay for accompaniment. Sheet:", playbackOsmdRef.current?.Sheet);
                                    setIsPlaybackOsmdReady(false);
                                }
                            }, 100);
                        } else {
                             setIsPlaybackOsmdReady(false);
                        }
                    })
                    .catch((err) => {
                        console.error("[OSMDPlayer] Error loading accompaniment XML into playbackOSMD:", err);
                        setIsPlaybackOsmdReady(false);
                    });
            } else if (playbackOsmdRef.current && !accompanimentXml) {
                console.log("[OSMDPlayer] No accompanimentXml provided. Clearing playbackOSMD and setting not ready.");
                if(playbackOsmdRef.current.Sheet) playbackOsmdRef.current.clear();
                setIsPlaybackOsmdReady(false);
            }
        }
    }, [accompanimentXml]);

    // getNoteDurationMs: OSMDのnote.length.realValue（全音符を1.0とする比率）からミリ秒単位のデュレーションを計算
    const getNoteDurationMs = useCallback((osmdRealValue: number, bpm: number) => {
        // osmdRealValue は全音符を1.0とした比率と仮定
        // (例: 全音符=1.0, 二分音符=0.5, 四分音符=0.25, 八分音符=0.125)
        if (bpm <= 0) return 0;

        const quarterNoteMs = (60 / bpm) * 1000; // 四分音符のミリ秒
        const wholeNoteMs = quarterNoteMs * 4;   // 全音符のミリ秒

        return osmdRealValue * wholeNoteMs;
    },[]);

    const midiNoteNumberToFrequency = useCallback((midiNoteNumber: number): number => {
        return 440 * Math.pow(2, (midiNoteNumber - 69) / 12);
    },[]);

    const playBeepGeneric = useCallback((audioCtx: AudioContext | null, frequency: number, durationMs: number) => {
        if (!audioCtx || audioCtx.state === 'closed') {
            return;
        }
        try {
            const oscillator = audioCtx.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
            oscillator.connect(audioCtx.destination);
            oscillator.start();
            const stopTime = audioCtx.currentTime + Math.max(0.01, durationMs / 1000);
            oscillator.stop(stopTime);
        } catch (e) { console.error("[OSMDPlayer] playBeepGeneric error:", e); }
    }, []);

    const playMultipleBeepsGeneric = useCallback((
        audioCtx: AudioContext | null,
        frequencies: number[],
        durationMs: number
    ) => {
        if (!audioCtx || audioCtx.state === 'closed') {
            return;
        }
        const stopTime = audioCtx.currentTime + Math.max(0.01, durationMs / 1000);
        frequencies.forEach(frequency => {
            if (frequency <= 0) return;
            try {
                const oscillator = audioCtx.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
                oscillator.connect(audioCtx.destination);
                oscillator.start();
                oscillator.stop(stopTime);
            } catch (e) {
                console.error("[OSMDPlayer] playMultipleBeepsGeneric error for frequency", frequency, ":", e);
            }
        });
    }, []);

    const mainDisplayOSMDByCursor = useCallback((bpm: number) => {
        const currentOSMD = osmd.current;
        if (!currentOSMD || !currentOSMD.Sheet) {
            console.warn("[OSMDPlayer mainDisplayOSMDByCursor] osmd.current is not available or no sheet loaded.");
            displayStoppedRef.current = true;
            return;
        }
        displayStoppedRef.current = false;

        const cursor = currentOSMD.cursor;
        if (!cursor) {
            console.error("[OSMDPlayer mainDisplayOSMDByCursor] Main OSMD cursor is null. Aborting.");
            displayStoppedRef.current = true;
            return;
        }
        cursor.reset();
        cursor.show();
        musicClipRef.current = [];

        const step = () => {
            if (displayStoppedRef.current) {
                if(cursor) cursor.hide();
                return;
            }

            if (cursor.iterator.endReached) {
                cursor.reset();
                cursor.hide();
                console.log("[OSMDPlayer mainDisplayOSMDByCursor] Music clip (mainDisplay):", musicClipRef.current);
                displayStoppedRef.current = true;
                // 再生終了時に isPlaying を false にする
                // ただし、もう一方の再生(playOSMDByCursor)も終了しているか確認が必要な場合がある
                // ここでは、表示カーソルが終端に達したら全体の再生状態を停止と見なす（簡易的な場合）
                // setIsPlaying(false); // stopCombinedPlayback を呼ぶのがより適切
                return;
            }

            const voiceEntries = cursor.iterator.CurrentVoiceEntries;
            let durationMs = 0;

            if (voiceEntries.length === 0) {
                durationMs = 50;
            } else {
                const noteDurations = voiceEntries.flatMap(entry =>
                    entry.Notes.map(note => note.length.realValue)
                );
                const longestDurationRealValue = noteDurations.length > 0 ? Math.max(0, ...noteDurations) : 0;
                durationMs = getNoteDurationMs(longestDurationRealValue, bpm);

                if (durationMs > 0) {
                    voiceEntries.forEach(vEntry => {
                        vEntry.Notes.forEach(note => {
                            if (note.pitch) {
                                const freq = midiNoteNumberToFrequency(note.pitch.halfTone);
                                musicClipRef.current.push([freq, durationMs]);
                            } else {
                                musicClipRef.current.push([0, durationMs]);
                            }
                        });
                    });
                } else if (longestDurationRealValue === 0 && voiceEntries.length > 0) {
                    durationMs = 50;
                }
            }
            
            displayTimerIdRef.current = window.setTimeout(() => {
                if (!displayStoppedRef.current) {
                     cursor.next();
                     if (cursor.iterator.CurrentMeasure) {
                         const currentMeasureNumber = cursor.iterator.CurrentMeasure.MeasureNumber;
                         onRequestScrollToMeasure(currentMeasureNumber, true);
                     }
                }
                step();
            }, Math.max(durationMs, 30));
        };
        step();
    }, [osmd, getNoteDurationMs, midiNoteNumberToFrequency, onRequestScrollToMeasure /*, setIsPlaying*/]);


    const playOSMDByCursor = useCallback((bpm: number) => {
        accompanimentStoppedRef.current = false;
        scoreAudioStoppedRef.current = false;

        if (accompanimentAudioContextRef.current && accompanimentAudioContextRef.current.state !== 'closed') {
            accompanimentAudioContextRef.current.close().catch(e => console.warn("[OSMDPlayer playOSMDByCursor] Error closing accompanimentAudioContextRef:", e));
        }
        try {
            accompanimentAudioContextRef.current = new AudioContext();
        } catch (e) {
            console.error("[OSMDPlayer playOSMDByCursor] Failed to create AudioContext:", e);
            accompanimentStoppedRef.current = true;
            scoreAudioStoppedRef.current = true;
            return;
        }

        if (playbackStyle === 'metronome') {
            // getNoteDurationMs の第一引数は osmdRealValue (全音符=1.0 の比率)
            // 四分音符の realValue は 0.25
            const beatDurationMs = getNoteDurationMs(0.25, bpm); 
            if (beatDurationMs <= 0) {
                console.warn("[OSMDPlayer playOSMDByCursor] Metronome beat duration is zero or negative. Stopping metronome.");
                accompanimentStoppedRef.current = true;
                return;
            }
            const stepmetro = () => {
                if (accompanimentStoppedRef.current || !accompanimentAudioContextRef.current || accompanimentAudioContextRef.current.state === 'closed') {
                    if (accompanimentAudioContextRef.current && accompanimentAudioContextRef.current.state !== 'closed') {
                        accompanimentAudioContextRef.current.close().catch(e => console.warn("[OSMDPlayer playOSMDByCursor] Error closing accompanimentAudioContextRef in stepmetro:", e));
                    }
                    return;
                }
                playBeepGeneric(accompanimentAudioContextRef.current, 880, Math.min(50, beatDurationMs * 0.2));
                accompanimentTimerIdRef.current = window.setTimeout(stepmetro, beatDurationMs);
            };
            stepmetro();
            return;
        }

        let musicOSMD: OpenSheetMusicDisplay | null = null;
        let isAccompanimentPlayback = false;

        if (playbackStyle === 'accompaniment') {
            if (!isPlaybackOsmdReady || !playbackOsmdRef.current || !playbackOsmdRef.current.Sheet) {
                 console.warn("[OSMDPlayer playOSMDByCursor] Accompaniment OSMD not ready, not loaded, or no sheet. isPlaybackOsmdReady:", isPlaybackOsmdReady, "playbackOsmdRef.current:", !!playbackOsmdRef.current, "Sheet:", !!playbackOsmdRef.current?.Sheet);
                 accompanimentStoppedRef.current = true;
                 return;
            }
            musicOSMD = playbackOsmdRef.current;
            isAccompanimentPlayback = true;
        } else if (playbackStyle === 'score') {
            if (!osmd.current || !osmd.current.Sheet) {
                console.warn("[OSMDPlayer playOSMDByCursor] Main OSMD not available or no sheet loaded for score playback.");
                accompanimentStoppedRef.current = true;
                return;
            }
            musicOSMD = osmd.current;
        } else {
            console.error("[OSMDPlayer playOSMDByCursor] Unknown playback style for audio:", playbackStyle);
            accompanimentStoppedRef.current = true;
            return;
        }

        const cursor = musicOSMD.cursor;
        if (!cursor) {
            console.error(`[OSMDPlayer playOSMDByCursor] Cursor is null for playbackStyle: ${playbackStyle}. Aborting playback for this OSMD. musicOSMD instance:`, musicOSMD);
            accompanimentStoppedRef.current = true;
            return;
        }
        cursor.reset();
        if (isAccompanimentPlayback) {
            cursor.show();
        }

        const step = () => {
            if (accompanimentStoppedRef.current || !accompanimentAudioContextRef.current || accompanimentAudioContextRef.current.state === 'closed') {
                 if (accompanimentAudioContextRef.current && accompanimentAudioContextRef.current.state !== 'closed') {
                    accompanimentAudioContextRef.current.close().catch(e => console.warn("[OSMDPlayer playOSMDByCursor] Error closing accompanimentAudioContextRef in audio step:", e));
                }
                if (isAccompanimentPlayback && cursor) cursor.hide();
                return;
            }

            if (cursor.iterator.endReached) {
                cursor.reset();
                if (isAccompanimentPlayback) cursor.hide();
                accompanimentStoppedRef.current = true;
                // setIsPlaying(false); // 同上
                return;
            }

            const voiceEntries = cursor.iterator.CurrentVoiceEntries;
            let durationMs = 0;

            if (voiceEntries.length === 0) {
                 durationMs = 50;
            } else {
                const noteDurations = voiceEntries.flatMap(entry =>
                    entry.Notes.map(note => note.length.realValue)
                );
                const longestDurationRealValue = noteDurations.length > 0 ? Math.max(0, ...noteDurations) : 0;
                durationMs = getNoteDurationMs(longestDurationRealValue, bpm);

                if (durationMs > 0) {
                    const frequenciesToPlay: number[] = [];
                    voiceEntries.forEach(vEntry => {
                        vEntry.Notes.forEach(note => {
                            if (note.pitch) {
                                frequenciesToPlay.push(midiNoteNumberToFrequency(note.pitch.halfTone));
                            }
                        });
                    });
                    if (frequenciesToPlay.length > 0) {
                         playMultipleBeepsGeneric(accompanimentAudioContextRef.current, frequenciesToPlay, durationMs);
                    }
                } else if (longestDurationRealValue === 0 && voiceEntries.length > 0) {
                    durationMs = 50;
                }
            }

            accompanimentTimerIdRef.current = window.setTimeout(() => {
                if(!accompanimentStoppedRef.current) cursor.next();
                step();
            }, Math.max(durationMs, 30));
        };
        step();
    }, [
        osmd,
        playbackOsmdRef,
        isPlaybackOsmdReady,
        playbackStyle,
        getNoteDurationMs,
        midiNoteNumberToFrequency,
        playBeepGeneric,
        playMultipleBeepsGeneric,
        // setIsPlaying
    ]);

    const stopCombinedPlayback = useCallback(() => {
        console.log("[OSMDPlayer stopCombinedPlayback] Stopping combined playback.");
        setIsPlaying(false); // isPlaying を false に設定してUIを更新

        displayStoppedRef.current = true;
        if (displayTimerIdRef.current !== null) {
            clearTimeout(displayTimerIdRef.current);
            displayTimerIdRef.current = null;
        }
        if (osmd.current) {
            const cursor = osmd.current.cursor;
            if (cursor && typeof cursor.hide === 'function' && typeof cursor.reset === 'function') {
                try { cursor.hide(); cursor.reset(); } catch (e) { console.error("[OSMDPlayer stopCombinedPlayback] Error during osmd.current.cursor cleanup:", e); }
            }
        }

        accompanimentStoppedRef.current = true;
        scoreAudioStoppedRef.current = true;
        if (accompanimentTimerIdRef.current !== null) {
            clearTimeout(accompanimentTimerIdRef.current);
            accompanimentTimerIdRef.current = null;
        }
        if (accompanimentAudioContextRef.current && accompanimentAudioContextRef.current.state !== 'closed') {
            accompanimentAudioContextRef.current.close().catch(e => console.warn("[OSMDPlayer stopCombinedPlayback] Error closing accompanimentAudioContextRef:", e));
            accompanimentAudioContextRef.current = null;
        }

        if (playbackOsmdRef.current) {
            const cursor = playbackOsmdRef.current.cursor;
            if (cursor && typeof cursor.hide === 'function' && typeof cursor.reset === 'function') {
                try { cursor.hide(); cursor.reset(); } catch (e) { console.error("[OSMDPlayer stopCombinedPlayback] Error during playbackOsmdRef.current.cursor cleanup:", e); }
            }
        }
    }, [setIsPlaying, osmd]);


    const startCombinedPlayback = useCallback((bpmToPlay: number) => {
        console.log(`[OSMDPlayer startCombinedPlayback] Attempting to start playback at ${bpmToPlay} BPM. Current style: ${playbackStyle}, isPlaying: ${isPlayingRef.current}`);

        // isPlayingRef.current を参照して、本当に再生中なら停止する
        if (isPlayingRef.current) {
            console.log("[OSMDPlayer startCombinedPlayback] Playback was in progress, stopping first.");
            stopCombinedPlayback();
        }
        
        displayStoppedRef.current = false;
        accompanimentStoppedRef.current = false;
        scoreAudioStoppedRef.current = false;

        const mainSheetAvailable = !!osmd.current?.Sheet;
        const accompanimentSheetAvailableAndReady = playbackStyle === 'accompaniment' && isPlaybackOsmdReady && !!playbackOsmdRef.current?.Sheet && !!playbackOsmdRef.current?.cursor;
        const metronomeActive = playbackStyle === 'metronome';

        let shouldRunMainDisplay = false;
        let shouldRunAudioPlayback = false;

        if (playbackStyle === 'score') {
            if (mainSheetAvailable && osmd.current?.cursor) {
                shouldRunMainDisplay = true;
                shouldRunAudioPlayback = true;
            } else {
                 console.warn("[OSMDPlayer startCombinedPlayback] Cannot start 'score' playback: Main sheet or cursor not available.");
            }
        } else if (playbackStyle === 'metronome') {
            if (mainSheetAvailable && osmd.current?.cursor) shouldRunMainDisplay = true;
            shouldRunAudioPlayback = true;
        } else if (playbackStyle === 'accompaniment') {
            if (mainSheetAvailable && osmd.current?.cursor) shouldRunMainDisplay = true;
            if (accompanimentSheetAvailableAndReady) {
                shouldRunAudioPlayback = true;
            } else {
                console.warn(`[OSMDPlayer startCombinedPlayback] Cannot start 'accompaniment' audio: Accompaniment not ready. isPlaybackOsmdReady: ${isPlaybackOsmdReady}, Sheet: ${!!playbackOsmdRef.current?.Sheet}, Cursor: ${!!playbackOsmdRef.current?.cursor}`);
            }
        }

        if (!shouldRunMainDisplay && !shouldRunAudioPlayback) {
            console.warn("[OSMDPlayer startCombinedPlayback] Nothing to play or display. Aborting start.");
            setIsPlaying(false); // 再生するものがないので再生状態にしない
            return;
        }
        
        setIsPlaying(true); // ここで再生状態を true に設定

        if (shouldRunMainDisplay) {
            console.log("[OSMDPlayer startCombinedPlayback] Starting main display cursor.");
            mainDisplayOSMDByCursor(bpmToPlay);
        } else {
             displayStoppedRef.current = true;
        }

        if (shouldRunAudioPlayback) {
            console.log("[OSMDPlayer startCombinedPlayback] Starting audio playback.");
            playOSMDByCursor(bpmToPlay);
        } else {
            accompanimentStoppedRef.current = true;
            scoreAudioStoppedRef.current = true;
        }

    }, [
        mainDisplayOSMDByCursor,
        playOSMDByCursor,
        setIsPlaying, // isPlaying のセッターを依存配列に追加
        osmd,
        playbackStyle,
        isPlaybackOsmdReady,
        stopCombinedPlayback
    ]);


    const handlePlayPause = useCallback(() => {
        if (isPlayingRef.current) { // isPlayingRef.current で現在の状態を確認
            stopCombinedPlayback();
        } else {
            startCombinedPlayback(getCurrentBpm());
        }
    }, [stopCombinedPlayback, startCombinedPlayback, getCurrentBpm]);


    const togglePlaybackStyle = useCallback(() => {
        if (isPlayingRef.current) {
            stopCombinedPlayback();
        }
        setPlaybackStyle(prevStyle => {
            const hasAccompaniment = isPlaybackOsmdReady && !!accompanimentXml;
            if (prevStyle === 'score') return 'metronome';
            if (prevStyle === 'metronome') return hasAccompaniment ? 'accompaniment' : 'score';
            if (prevStyle === 'accompaniment') return 'score';
            return 'score';
        });
    }, [isPlaybackOsmdReady, accompanimentXml, stopCombinedPlayback]);

    const getPlaybackStyleButtonContent = useCallback((
        style: PlaybackStyle,
        accompanimentReadyAndXmlProvided: boolean
    ): { icon: JSX.Element; text: string } => {
        switch (style) {
            case 'score': return { icon: <MdQueueMusic size="1.2em" />, text: "楽譜通り" };
            case 'metronome': return { icon: <TbMetronome size="1.2em" />, text: "メトロノーム" };
            case 'accompaniment':
                return {
                    icon: accompanimentReadyAndXmlProvided ? <LuPiano size="1.2em" /> : <MdQueueMusic size="1.2em" />,
                    text: accompanimentReadyAndXmlProvided ? "伴奏" : "伴奏なし"
                };
            default: return { icon: <IoMusicalNotesOutline size="1.2em" />, text: "スタイル切替" };
        }
    }, []);

    const buttonContent = getPlaybackStyleButtonContent(playbackStyle, isPlaybackOsmdReady && !!accompanimentXml);
    
    const handleBpmChangeWithStop = useCallback((doUp: boolean) => {
        if (isPlayingRef.current) {
            stopCombinedPlayback();
        }
        handlebpmChange(doUp);
    }, [handlebpmChange, stopCombinedPlayback]);

    const handleDifficultyChangeWithStop = useCallback((newDiff: Difficulty) => {
        if (isPlayingRef.current) {
            stopCombinedPlayback();
        }
        onDifficultyChange(newDiff);
    }, [onDifficultyChange, stopCombinedPlayback]);

    // 再生ループが両方とも終了したかをチェックするロジックの追加 (オプション)
    useEffect(() => {
        if (isPlaying && displayStoppedRef.current && accompanimentStoppedRef.current) {
            console.log("[OSMDPlayer] Both playback loops have stopped, setting isPlaying to false.");
            setIsPlaying(false);
        }
    }, [isPlaying, displayStoppedRef.current, accompanimentStoppedRef.current, setIsPlaying]);


    return (
        <div>
            <div ref={playbackOsmdContainerRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}/>
            <button onClick={() => handleBpmChangeWithStop(false)} disabled={isPlaying && getCurrentBpm() <= (10 - basebpm + basebpm)}>BPM ＜＜</button>
            <span style={{ display: 'inline-block', minWidth: '4em', textAlign: 'center', margin: '0 5px' }}>{getCurrentBpm()}bpm</span>
            <button onClick={() => handleBpmChangeWithStop(true)}>BPM ＞＞</button>
            
            <button onClick={handlePlayPause} style={{ marginLeft: '10px' }}>
                {isPlaying ? "⏹️ 停止" : "▶️ 再生"}
            </button>

            <button style={{ marginLeft: '10px' }} onClick={() => {
                if(isPlayingRef.current) return;
                if(osmd.current?.cursor?.iterator) { osmd.current.cursor.next(); if(osmd.current.cursor.iterator.CurrentMeasure) { onRequestScrollToMeasure(osmd.current.cursor.iterator.CurrentMeasure.MeasureNumber, true); } }
            }} disabled={!osmd.current?.Sheet || isPlaying}>次へ</button>
            <button onClick={() => {
                if(isPlayingRef.current) return;
                if(osmd.current?.cursor?.iterator) { osmd.current.cursor.previous(); if(osmd.current.cursor.iterator.CurrentMeasure) { onRequestScrollToMeasure(osmd.current.cursor.iterator.CurrentMeasure.MeasureNumber, true); } }
            }} disabled={!osmd.current?.Sheet || isPlaying}>前へ</button>

            <button style={{ marginLeft: '10px' }} onClick={() => onProficiencyUpdate(getDummyProficiency())} disabled={isPlaying}>習熟度(仮)</button>
            <button style={{ marginLeft: '10px' }} onClick={() => handleDifficultyChangeWithStop(Math.max(0, difficulty - 1) as Difficulty)} disabled={difficulty === 0 || isPlaying}>難易度 ＜</button>
            <span style={{ display: 'inline-block', minWidth: '3em', textAlign: 'center', margin: '0 5px' }}>{difficulty === 0 ? "auto" : `Lv ${difficulty}`}</span>
            <button onClick={() => handleDifficultyChangeWithStop(Math.min(5, difficulty + 1) as Difficulty)} disabled={difficulty === 5 || isPlaying}>難易度 ＞</button>

            <div style={{ marginTop: '10px' }}>
                <button onClick={() => setIsRecordingEnabled(!isRecordingEnabled)} style={{ marginRight: '10px' }} disabled={isPlaying}>
                    録音: {isRecordingEnabled ? "ON" : "OFF"} {isActuallyRecording ? "(録音中)" : ""}
                </button>
                <button onClick={togglePlaybackStyle} title="再生方法を切り替えます" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3em' }} disabled={isPlaying}>
                    {buttonContent.icon} {buttonContent.text}
                </button>
            </div>
        </div>
    );
}