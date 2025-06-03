import React, { useEffect, useRef, useState, useCallback } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Difficulty } from '../types/types'; // 適切な型のパスを指定してください
import {
  IoMusicalNotesOutline,
  IoPlaySkipBackSharp,
  IoPlaySkipForwardSharp,
  IoPlaySharp,
  IoPauseSharp,
  IoMicOutline,
  IoStopCircleOutline,
} from 'react-icons/io5';
import { MdQueueMusic } from "react-icons/md";
import { LuPiano } from "react-icons/lu";
import { TbMetronome } from 'react-icons/tb';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import axios from 'axios';
// WebCodecs API の型定義 (グローバルに存在しない場合)
declare global {
  interface AudioData {
    format: string;
    sampleRate: number;
    numberOfFrames: number;
    numberOfChannels: number;
    duration: number; // microseconds
    timestamp: number; // microseconds
    copyTo(destination: BufferSource, options: { planeIndex: number; frameOffset?: number; frameCount?: number }): void;
    clone(): AudioData;
    close(): void;
  }
  interface MediaStreamTrackProcessor<T = any> {
    readable: ReadableStream<T>;
  }
  var MediaStreamTrackProcessor: {
    prototype: MediaStreamTrackProcessor;
    new (init: { track: MediaStreamTrack }): MediaStreamTrackProcessor<AudioData>;
  };
}

interface OSMDPlayerProps {
  osmd: React.RefObject<OpenSheetMusicDisplay>;
  difficulty: Difficulty;
  accompanimentXml?: string | null;
  basebpm: number;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onProficiencyUpdate: (newProficiency: number) => void;
  getMeasureDifficulty: (measurenum: number) => Difficulty; // ユーザーコードに含まれていたため残します
  onRequestScrollToMeasure: (measureNumber: number, smooth?: boolean) => void;
}

type PlaybackStyle = 'score' | 'metronome' | 'accompaniment';

const getDummyProficiency = (): number => { // ユーザーコードに含まれていたため残します
    return Math.floor(Math.random() * 10) + 1;
};

const MIN_TIMEOUT_DELAY = 15;
const NEXT_STEP_DELAY = 0;

export function OSMDPlayer({
    osmd,
    difficulty,
    accompanimentXml,
    basebpm,
    onDifficultyChange,
    onProficiencyUpdate,
    getMeasureDifficulty, // ユーザーコードに含まれていたため残します
    onRequestScrollToMeasure,
}: OSMDPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useRef(isPlaying);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    const [currentBpmRato, setCurrentBpmRato] = useState<number>(0);
    const getCurrentBpm = useCallback(() => basebpm + currentBpmRato, [basebpm, currentBpmRato]);
    const handlebpmChangeCallback = useCallback((doUp : boolean) => {
        if(doUp) setCurrentBpmRato(prev => prev + 10);
        else setCurrentBpmRato(prev => Math.max(prev - 10, 10 - basebpm));
    }, [basebpm]);

    const mainAudioContextRef = useRef<AudioContext | null>(null);
    const accompanimentAudioContextRef = useRef<AudioContext | null>(null);

    const displayTimerIdRef = useRef<number | null>(null);
    const displayStoppedRef = useRef(true);

    const accompanimentTimerIdRef = useRef<number | null>(null);
    const accompanimentStoppedRef = useRef(true);
    const playbackOsmdContainerRef = useRef<HTMLDivElement>(null);
    const playbackOsmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    const [isPlaybackOsmdReady, setIsPlaybackOsmdReady] = useState(false);

    const scoreAudioStoppedRef = useRef(true);

    const [isRecordingFeatureEnabled, setIsRecordingFeatureEnabled] = useState(true);
    const [isActuallyRecording, setIsActuallyRecording] = useState(false);
    const isActuallyRecordingRef = useRef(isActuallyRecording);
    useEffect(() => { isActuallyRecordingRef.current = isActuallyRecording; }, [isActuallyRecording]);
    
    const streamRef = useRef<MediaStream | null>(null);
    const audioTrackRef = useRef<MediaStreamTrack | null>(null);
    const audioFrameProcessorRef = useRef<MediaStreamTrackProcessor<AudioData> | null>(null);
    const audioFramesForCurrentMeasureRef = useRef<AudioData[]>([]);
    const stopAudioProcessingRef = useRef<(() => void) | null>(null);

    const [playbackStyle, setPlaybackStyle] = useState<PlaybackStyle>('accompaniment');

    useEffect(() => {
        if (typeof MediaStreamTrackProcessor === 'undefined') {
            console.warn("WebCodecs API (MediaStreamTrackProcessor) is not supported in this browser.");
            setIsRecordingFeatureEnabled(false);
        }
    }, []);

    useEffect(() => {
        if (playbackOsmdContainerRef.current) {
            if (!playbackOsmdRef.current) {
                try {
                    playbackOsmdRef.current = new OpenSheetMusicDisplay(playbackOsmdContainerRef.current, {
                        autoResize: false, backend: "svg", drawTitle: false, drawSubtitle: false,
                        drawComposer: false, drawLyricist: false, drawMetronomeMarks: false,
                        drawPartNames: false, drawMeasureNumbers: false,
                    });
                } catch (error) { console.error("[OSMDPlayer] Failed to init playback OSMD instance:", error); setIsPlaybackOsmdReady(false); return; }
            }
            if (playbackOsmdRef.current && accompanimentXml) {
                setIsPlaybackOsmdReady(false);
                playbackOsmdRef.current.load(accompanimentXml)
                    .then(() => {
                        if (playbackOsmdRef.current) {
                            playbackOsmdRef.current.render();
                            setTimeout(() => {
                                if (playbackOsmdRef.current?.cursor) { setIsPlaybackOsmdReady(true); } 
                                else { setIsPlaybackOsmdReady(false); }
                            }, 100);
                        } else setIsPlaybackOsmdReady(false);
                    })
                    .catch((err) => { 
                        console.error("[OSMDPlayer] Error loading accompaniment XML:", err);
                        setIsPlaybackOsmdReady(false);
                    });
            } else if (playbackOsmdRef.current && !accompanimentXml) {
                if(playbackOsmdRef.current.Sheet) playbackOsmdRef.current.clear();
                setIsPlaybackOsmdReady(false);
            }
        }
    }, [accompanimentXml]);

    const getNoteDurationMs = useCallback((osmdRealValue: number, bpm: number) => {
        if (bpm <= 0) return 0;
        const quarterNoteMs = (60 / bpm) * 1000;
        const wholeNoteMs = quarterNoteMs * 4;
        return osmdRealValue * wholeNoteMs;
    },[]);

    const midiNoteNumberToFrequency = useCallback((midiNoteNumber: number): number => {
        return 440 * Math.pow(2, (midiNoteNumber - 69) / 12+1);
    },[]);

    const playBeepGeneric = useCallback((audioCtx: AudioContext | null, frequency: number, durationMs: number) => {
        if (!audioCtx || audioCtx.state === 'closed') return;
        try {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain(); 
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime); 
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + Math.max(0.01, durationMs / 1000));
        } catch (e) { console.error("[OSMDPlayer] playBeepGeneric error:", e); }
    }, []);

    const playMultipleBeepsGeneric = useCallback((
        audioCtx: AudioContext | null,
        frequencies: number[],
        durationMs: number
    ) => {
        if (!audioCtx || audioCtx.state === 'closed') {
            console.warn("[OSMDPlayer] playMultipleBeepsGeneric: AudioContext not available or closed.");
            return;
        }
        const stopTime = audioCtx.currentTime + Math.max(0.01, durationMs / 1000);
        const validFrequencies = frequencies.filter(f => f > 0);
        const numNotes = validFrequencies.length;
        if (numNotes === 0) return;
        const gainValue = numNotes > 1 ? (1.0 / Math.sqrt(numNotes)) : 1.0;
        validFrequencies.forEach(frequency => {
            try {
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(gainValue, audioCtx.currentTime);
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.start();
                oscillator.stop(stopTime);
            } catch (e) {
                console.error("[OSMDPlayer] playMultipleBeepsGeneric error for freq", frequency, ":", e);
            }
        });
    }, []);

    const activeMeasureNumberRef_mainDisplay = useRef<number>(0);
    const clipsForCurrentMeasureRef_mainDisplay = useRef<[number, number][]>([]);

    const processAudioFramesForMeasure = useCallback(async (
        measureNumber: number,
        musicClips: [number, number][], // [frequency, durationMs][] と仮定
        audioFrames: AudioData[]
    ) => {
        console.log(`[WebCodecs Data] Processing for 小節 ${measureNumber} (n-1):`);
        console.log(`  ├─ musicClipRef (正解データ):`, musicClips);

        if (!isActuallyRecordingRef.current && audioFrames.length === 0) {
            console.log(`  └─ AudioFrames: (録音機能停止中 or no frames for this segment)`);
            return;
        }
        if (audioFrames.length === 0) {
            console.log(`  └─ AudioFrames: (この区間の音声フレームなし)`);
            return;
        }
        
        console.log(`  └─ Processing ${audioFrames.length} AudioData frame(s) for measure ${measureNumber}:`);

        let finalPcmData: Float32Array | null = null;
        let actualSampleRate: number = 0; // 実際のサンプリングレートを保持

        try {
            let totalSamples = 0;
            let sampleRateFromFrames = 0;
            let numberOfChannels = 0;

            for (const frame of audioFrames) {
                totalSamples += frame.numberOfFrames * frame.numberOfChannels;
                if (sampleRateFromFrames === 0 && frame.sampleRate > 0) sampleRateFromFrames = frame.sampleRate;
                if (numberOfChannels === 0 && frame.numberOfChannels > 0) numberOfChannels = frame.numberOfChannels;
                
                // サンプルレートやチャンネル数がフレーム間で異なる場合の警告 (最初の有効な値を採用)
                if (frame.sampleRate > 0 && sampleRateFromFrames > 0 && frame.sampleRate !== sampleRateFromFrames) {
                    console.warn(`[WebCodecs Data] Inconsistent audio frame sampleRate. Expected ${sampleRateFromFrames}, got ${frame.sampleRate}. Using first detected rate.`);
                }
                if (frame.numberOfChannels > 0 && numberOfChannels > 0 && frame.numberOfChannels !== numberOfChannels) {
                    console.warn(`[WebCodecs Data] Inconsistent audio frame numberOfChannels. Expected ${numberOfChannels}, got ${frame.numberOfChannels}. Using first detected count.`);
                }
            }
            actualSampleRate = sampleRateFromFrames; 
            
            if (totalSamples === 0 || numberOfChannels === 0 || actualSampleRate === 0) {
                console.log(`      └─ No actual samples, channels, or valid sampleRate in received AudioData frames. SR: ${actualSampleRate}, Ch: ${numberOfChannels}, Samples: ${totalSamples}`);
                audioFrames.forEach(frame => { try { frame.close(); } catch(e){} });
                return; 
            }

            const combinedPcmData = new Float32Array(Math.floor(totalSamples / numberOfChannels)); // 整数にする
            let currentOffset = 0;

            for (const frame of audioFrames) {
                const frameDataSize = frame.numberOfFrames;
                if (frame.format === 'f32-planar' || frame.format === 'f32' || frame.format === 'S16' || frame.format === 'S32' || frame.format === 'U8') {
                    const singleChannelFrameData = new Float32Array(frame.numberOfFrames);
                    try {
                        if (frame.numberOfChannels === 1) {
                             frame.copyTo(singleChannelFrameData, { planeIndex: 0, frameCount: frame.numberOfFrames });
                        } else if (frame.numberOfChannels > 1 && (frame.format === 'f32-planar')) {
                            // 最初のチャンネル(planeIndex: 0)のデータを取得
                            frame.copyTo(singleChannelFrameData, { planeIndex: 0, frameCount: frame.numberOfFrames });
                        } else if (frame.numberOfChannels > 1 && frame.format === 'f32') {
                            // インターリーブ形式の場合、最初のチャンネルを抽出
                            const interleavedData = new Float32Array(frame.numberOfFrames * frame.numberOfChannels);
                            frame.copyTo(interleavedData, { planeIndex: 0, frameCount: frame.numberOfFrames });
                            for (let i = 0; i < frame.numberOfFrames; i++) {
                                singleChannelFrameData[i] = interleavedData[i * frame.numberOfChannels + 0]; // 0番目のチャンネル
                            }
                        } else {
                            console.warn(`[WebCodecs Data] Unsupported channel/format combination for direct extraction: ${frame.format}, channels: ${frame.numberOfChannels}`);
                            frame.close();
                            continue;
                        }
                        // 配列の範囲外アクセスを防ぐ
                        if (currentOffset + singleChannelFrameData.length <= combinedPcmData.length) {
                            combinedPcmData.set(singleChannelFrameData, currentOffset);
                            currentOffset += singleChannelFrameData.length;
                        } else {
                            console.warn("[WebCodecs Data] Buffer overflow averted while combining PCM data. Some data might be truncated.");
                            // 残りだけコピーするなど、より詳細なハンドリングも可能
                            const remainingSpace = combinedPcmData.length - currentOffset;
                            if (remainingSpace > 0) {
                                combinedPcmData.set(singleChannelFrameData.slice(0, remainingSpace), currentOffset);
                                currentOffset += remainingSpace;
                            }
                            frame.close(); // このフレームはこれ以上処理できないので閉じる
                            break; // ループを抜ける
                        }
                    } catch (e) {
                        console.error("[WebCodecs Data] Error copying data from AudioData frame:", e, frame);
                    }
                } else {
                     console.warn(`[WebCodecs Data] Unknown or unhandled AudioData format: ${frame.format}. Skipping frame.`);
                }
                frame.close();
            }
            
            finalPcmData = combinedPcmData.slice(0, currentOffset);

            console.log(`      ├─ Combined PCM Data: Sample Rate: ${actualSampleRate}Hz, Channels (processed): 1, Length: ${finalPcmData.length} samples`);
            const samplesToDisplay = 100;
            console.log(`        └─ First ${Math.min(samplesToDisplay, finalPcmData.length)} Samples:`, finalPcmData.slice(0, samplesToDisplay));
            
        } catch (error) {
            console.error(`[WebCodecs Data] Error processing AudioData frames for measure ${measureNumber}:`, error);
            audioFrames.forEach(frame => {
                try { frame.close(); } catch (e) { /* ignore close error */ }
            });
            return; 
        }

        // --- API通信処理 ---
        if (finalPcmData && finalPcmData.length > 0 && actualSampleRate > 0 && isActuallyRecordingRef.current) {
            const measureDiff = getMeasureDifficulty(measureNumber); 
        
            // --- durationMsのスケーリング処理 ---
            let totalSheetDurationMs = 0;
            musicClips.forEach(clip => {
                totalSheetDurationMs += clip[1]; // clip[1] は durationMs
            });

            // 録音されたオーディオの実際のミリ秒単位の長さ
            const actualAudioDurationMs = (finalPcmData.length / actualSampleRate) * 1000;

            let scalingFactor = 1.0;
            if (totalSheetDurationMs > 0) {
                scalingFactor = actualAudioDurationMs / totalSheetDurationMs;
            } else if (actualAudioDurationMs > 0) {
                // シート上にノートがないが音声がある場合、durationMsはそのまま送られる
                // scalingFactor = 1.0; のまま
            }

            // musicClipsの形式を維持しつつ、durationMsをスケーリング
            // ここで新しい配列を作成し、元のmusicClipsを変更しない
            const correctPitchesForApi: number[][] = musicClips.map(clip => [
                clip[0], // frequency (Hz)
                clip[1] * scalingFactor // duration (ms) - スケーリングファクターを適用
            ]); 
            
            // const correctPitchesForApi: number[][] = musicClips.map(clip => [
            //     clip[0], // frequency (Hz)
            //     clip[1]  // duration (ms)
            // ]);

            const payload = {
                audio: Array.from(finalPcmData), 
                difficulty: measureDiff,
                correct_pitches: correctPitchesForApi,
                // correct_pitches: musicClips,
                // correct_pitches: correctPitchesForApi,
                // sampling_rate はGo側で固定値(48000.0)が使われるため、ここでは送信しない。
                // もしPython側でフロントの実際のサンプリングレートが必要な場合は、
                // GoのAPI仕様とPythonスクリプト呼び出しを変更し、ここから actualSampleRate を送信する必要がある。
                // current_proficiency もGo側でDBから取得するため送信しない。
            };
            console.log(`[API Send] /calc_proficiency for measure ${measureNumber} with difficulty ${measureDiff}. Actual SR: ${actualSampleRate}Hz (Note: Go backend might use a fixed SR for Python script).`);
            console.log(payload.correct_pitches)
            console.log(payload.audio)
            console.log(`[API Send] Payload (summary):`, {
                audio_length: payload.audio.length,
                difficulty: payload.difficulty,
                correct_pitches_count: payload.correct_pitches.length,
            });

            try {
                // const response = await fetch(`http://localhost:8080/calc_proficiency`, {
                //     method: 'POST',
                //     headers: {
                //         'Content-Type': 'application/json',
                //     },
                //     body: JSON.stringify(payload),
                // });
                const response = await axios.post(`http://localhost:8080/calc_proficiency`, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                const proficiencyResponse = response.data; 
                console.log(proficiencyResponse)
            if (proficiencyResponse && typeof proficiencyResponse.proficiency === 'number') {
                const newOverallProficiency = proficiencyResponse.proficiency;
                console.log(`[API Recv] Calculated new overall proficiency (for measure ${measureNumber}):`, newOverallProficiency);
                onProficiencyUpdate(newOverallProficiency); 
            } else {
                console.error("[API Recv Error] Unexpected response format from /calc_proficiency:", proficiencyResponse);
                throw new Error("Invalid response format from proficiency calculation API.");
            }

        } catch (error) {
            // axios のエラーハンドリング
            if (axios.isAxiosError(error)) {
                // AxiosErrorの場合、responseプロパティにサーバーからの応答が含まれる可能性がある
                const status = error.response ? error.response.status : 'N/A';
                const errorBody = error.response ? JSON.stringify(error.response.data) : error.message;
                console.error(`[API Recv Error] /calc_proficiency request failed: ${status} ${error.response?.statusText || ''}`, errorBody);
                let detailedError = errorBody;
                try {
                    const errorJson = JSON.parse(errorBody);
                    if (errorJson && errorJson.error) {
                        detailedError = errorJson.error;
                    }
                } catch(e) { /* ignore */ }
                throw new Error(`API /calc_proficiency request failed: ${status} - ${detailedError}`);
            } else {
                // その他のエラー
                console.error(`[API Call Error] Failed to calculate proficiency for measure ${measureNumber}:`, error);
                throw error; // エラーを再スロー
            }
        }
    } else if (finalPcmData && (finalPcmData.length === 0 || actualSampleRate === 0)) {
        console.log(`[API Send] No valid PCM data (length: ${finalPcmData?.length}, SR: ${actualSampleRate}) to send for measure ${measureNumber}. Skipping API call.`);
    } else if (!isActuallyRecordingRef.current) {
        console.log(`[API Send] Not currently recording. Skipping API call for measure ${measureNumber}.`);
    }
}, [getMeasureDifficulty, onProficiencyUpdate]);


    const mainDisplayOSMDByCursor = useCallback((bpm: number) => {
    const currentOSMD = osmd.current;
    if (!currentOSMD || !currentOSMD.Sheet) { displayStoppedRef.current = true; return; }
    displayStoppedRef.current = false;
    const cursor = currentOSMD.cursor;
    if (!cursor) { displayStoppedRef.current = true; return; }
    
    cursor.reset();
    cursor.show();
    activeMeasureNumberRef_mainDisplay.current = 0;
    clipsForCurrentMeasureRef_mainDisplay.current = [];
    audioFramesForCurrentMeasureRef.current = [];

    if (cursor.iterator.CurrentMeasure) {
        activeMeasureNumberRef_mainDisplay.current = cursor.iterator.CurrentMeasure.MeasureNumber;
    }

    const step = () => {
        if (displayStoppedRef.current) {
            if (cursor) cursor.hide();
            if (activeMeasureNumberRef_mainDisplay.current > 0) {
                processAudioFramesForMeasure(
                    activeMeasureNumberRef_mainDisplay.current,
                    [...clipsForCurrentMeasureRef_mainDisplay.current],
                    [...audioFramesForCurrentMeasureRef.current]
                );
                audioFramesForCurrentMeasureRef.current = [];
            }
            return;
        }

        if (cursor.iterator.endReached) {
            if (activeMeasureRef_mainDisplay.current > 0) {
                processAudioFramesForMeasure(
                    activeMeasureNumberRef_mainDisplay.current,
                    [...clipsForCurrentMeasureRef_mainDisplay.current],
                    [...audioFramesForCurrentMeasureRef.current]
                );
                audioFramesForCurrentMeasureRef.current = [];
            }
            cursor.reset(); cursor.hide(); displayStoppedRef.current = true;
            return;
        }
        
        const currentIteratorMeasure = cursor.iterator.CurrentMeasure;
        if (currentIteratorMeasure && currentIteratorMeasure.MeasureNumber !== activeMeasureNumberRef_mainDisplay.current) {
            if (activeMeasureNumberRef_mainDisplay.current > 0) { 
                processAudioFramesForMeasure(
                    activeMeasureNumberRef_mainDisplay.current,
                    [...clipsForCurrentMeasureRef_mainDisplay.current],
                    [...audioFramesForCurrentMeasureRef.current]
                );
            }
            activeMeasureNumberRef_mainDisplay.current = currentIteratorMeasure.MeasureNumber;
            clipsForCurrentMeasureRef_mainDisplay.current = [];
            audioFramesForCurrentMeasureRef.current = [];
        }

        const voiceEntries = cursor.iterator.CurrentVoiceEntries;
        let durationMs = 0;
        if (voiceEntries.length === 0) { durationMs = 50; } 
        else {
            const noteDurations = voiceEntries.flatMap(entry => entry.Notes.map(note => note.length.realValue));
            const longestDurationRealValue = noteDurations.length > 0 ? Math.max(0, ...noteDurations) : 0;
            durationMs = getNoteDurationMs(longestDurationRealValue, bpm);
            
            if (durationMs > 0 && activeMeasureNumberRef_mainDisplay.current > 0) {
                // ここを修正: forEach を使わず、最初の voiceEntry の最初の note のみを使用
                const firstVoiceEntry = voiceEntries[0];
                if (firstVoiceEntry && firstVoiceEntry.Notes.length > 0) {
                    const firstNote = firstVoiceEntry.Notes[0];
                    const freq = firstNote.pitch ? midiNoteNumberToFrequency(firstNote.pitch.halfTone) : 0;
                    
                    if (freq > 0) { // 周波数が有効な場合のみ追加
                        clipsForCurrentMeasureRef_mainDisplay.current.push([freq, durationMs]);
                        // console.log(`[DEBUG] Added single note (Freq: ${freq.toFixed(2)}, Dur: ${durationMs}) for measure ${activeMeasureNumberRef_mainDisplay.current}`);
                    }
                }
            } else if (longestDurationRealValue === 0 && voiceEntries.length > 0) { durationMs = 50; }
        }
        
        const timeoutDelay = Math.max(durationMs, MIN_TIMEOUT_DELAY);
        if(displayTimerIdRef.current) clearTimeout(displayTimerIdRef.current);
        displayTimerIdRef.current = window.setTimeout(() => {
            if (!displayStoppedRef.current) {
                 cursor.next();
                 if (cursor.iterator.CurrentMeasure) onRequestScrollToMeasure(cursor.iterator.CurrentMeasure.MeasureNumber, true);
                 if(displayTimerIdRef.current) clearTimeout(displayTimerIdRef.current);
                 displayTimerIdRef.current = window.setTimeout(step, NEXT_STEP_DELAY);
            } else { step(); }
        }, timeoutDelay);
    };
    step();
}, [osmd, getNoteDurationMs, midiNoteNumberToFrequency, onRequestScrollToMeasure, processAudioFramesForMeasure]);


    const playOSMDByCursor = useCallback((bpm: number) => {
        accompanimentStoppedRef.current = false; scoreAudioStoppedRef.current = false;
        if (accompanimentAudioContextRef.current && accompanimentAudioContextRef.current.state !== 'closed') {
            accompanimentAudioContextRef.current.close().catch(e => {});
        }
        try { accompanimentAudioContextRef.current = new AudioContext(); } 
        catch (e) { accompanimentStoppedRef.current = true; return; }
        if (playbackStyle === 'metronome') {
            const beatDurationMs = getNoteDurationMs(0.25, bpm);
            if (beatDurationMs <= 0) { accompanimentStoppedRef.current = true; return; }
            const stepmetro = () => {
                if (accompanimentStoppedRef.current || !accompanimentAudioContextRef.current || accompanimentAudioContextRef.current.state === 'closed') return;
                playBeepGeneric(accompanimentAudioContextRef.current, 880, Math.min(50, beatDurationMs * 0.2));
                if(accompanimentTimerIdRef.current) clearTimeout(accompanimentTimerIdRef.current);
                accompanimentTimerIdRef.current = window.setTimeout(stepmetro, beatDurationMs);
            }; stepmetro(); return;
        }
        let musicOSMD: OpenSheetMusicDisplay | null = null;
        let isAcc = false;
        if (playbackStyle === 'accompaniment') {
            if (!isPlaybackOsmdReady || !playbackOsmdRef.current || !playbackOsmdRef.current.Sheet || !playbackOsmdRef.current.cursor) { accompanimentStoppedRef.current = true; return; }
            musicOSMD = playbackOsmdRef.current; isAcc = true;
        } else if (playbackStyle === 'score') {
            if (!osmd.current || !osmd.current.Sheet || !osmd.current.cursor) { accompanimentStoppedRef.current = true; return; }
            musicOSMD = osmd.current;
        } else { accompanimentStoppedRef.current = true; return; }
        const cursor = musicOSMD.cursor; cursor.reset(); if (isAcc) cursor.show();
        const step = () => {
            if (accompanimentStoppedRef.current || !accompanimentAudioContextRef.current || accompanimentAudioContextRef.current.state === 'closed') { if (isAcc && cursor) cursor.hide(); return; }
            if (cursor.iterator.endReached) { if (isAcc) cursor.hide(); cursor.reset(); accompanimentStoppedRef.current = true; return; }
            const voiceEntries = cursor.iterator.CurrentVoiceEntries;
            let durationMs = 0;
            if (voiceEntries.length === 0) { durationMs = 50; }
            else {
                const noteDurations = voiceEntries.flatMap(entry => entry.Notes.map(note => note.length.realValue));
                const longestDurationRealValue = noteDurations.length > 0 ? Math.max(0, ...noteDurations) : 0;
                durationMs = getNoteDurationMs(longestDurationRealValue, bpm);
                if (durationMs > 0) {
                    const freqs = voiceEntries.flatMap(ve => ve.Notes.filter(n => n.pitch).map(n => midiNoteNumberToFrequency(n.pitch.halfTone)));
                    if (freqs.length > 0) playMultipleBeepsGeneric(accompanimentAudioContextRef.current, freqs, durationMs);
                } else if (longestDurationRealValue === 0 && voiceEntries.length > 0) { durationMs = 50; }
            }
            const timeoutDelay = Math.max(durationMs, MIN_TIMEOUT_DELAY);
            if(accompanimentTimerIdRef.current) clearTimeout(accompanimentTimerIdRef.current);
            accompanimentTimerIdRef.current = window.setTimeout(() => {
                if(!accompanimentStoppedRef.current) {
                    cursor.next();
                    if(accompanimentTimerIdRef.current) clearTimeout(accompanimentTimerIdRef.current);
                    accompanimentTimerIdRef.current = window.setTimeout(step, NEXT_STEP_DELAY);
                } else { step(); }
            }, timeoutDelay);
        }; step();
    }, [ osmd, playbackOsmdRef, isPlaybackOsmdReady, playbackStyle, getNoteDurationMs, midiNoteNumberToFrequency, playBeepGeneric, playMultipleBeepsGeneric ]);

    const stopCombinedPlayback = useCallback(() => {
        setIsPlaying(false);
        displayStoppedRef.current = true;
        if (displayTimerIdRef.current !== null) { clearTimeout(displayTimerIdRef.current); displayTimerIdRef.current = null; }
        if (osmd.current?.cursor) { try { osmd.current.cursor.hide(); osmd.current.cursor.reset(); } catch(e){} }
        accompanimentStoppedRef.current = true; scoreAudioStoppedRef.current = true;
        if (accompanimentTimerIdRef.current !== null) { clearTimeout(accompanimentTimerIdRef.current); accompanimentTimerIdRef.current = null; }
        if (accompanimentAudioContextRef.current && accompanimentAudioContextRef.current.state !== 'closed') {
            accompanimentAudioContextRef.current.close().catch(e => {});
            accompanimentAudioContextRef.current = null;
        }
        if (playbackOsmdRef.current?.cursor) { try { playbackOsmdRef.current.cursor.hide(); playbackOsmdRef.current.cursor.reset(); } catch(e){} }
    }, [setIsPlaying, osmd]);
    
    const startCombinedPlayback = useCallback((bpmToPlay: number) => {
        if (isPlayingRef.current) stopCombinedPlayback();
        displayStoppedRef.current = false; accompanimentStoppedRef.current = false; scoreAudioStoppedRef.current = false;
        const mainSheetOk = !!osmd.current?.Sheet && !!osmd.current?.cursor;
        const accOk = playbackStyle === 'accompaniment' && isPlaybackOsmdReady && !!playbackOsmdRef.current?.Sheet && !!playbackOsmdRef.current?.cursor;
        let runMain = false, runAudio = false;
        if (playbackStyle === 'score') { if (mainSheetOk) { runMain = true; runAudio = true; } }
        else if (playbackStyle === 'metronome') { if (mainSheetOk) runMain = true; runAudio = true; } 
        else if (playbackStyle === 'accompaniment') { if (mainSheetOk) runMain = true; if (accOk) runAudio = true; }
        if (!runMain && !runAudio && playbackStyle !== 'metronome') { setIsPlaying(false); return; }
        if (playbackStyle === 'metronome' && !runAudio && mainSheetOk) runAudio = true; 
        
        setIsPlaying(true);
        if (runAudio) playOSMDByCursor(bpmToPlay); 
        else { accompanimentStoppedRef.current = true; scoreAudioStoppedRef.current = true; }
        if (runMain) mainDisplayOSMDByCursor(bpmToPlay); 
        else displayStoppedRef.current = true;
    }, [ mainDisplayOSMDByCursor, playOSMDByCursor, setIsPlaying, osmd, playbackStyle, isPlaybackOsmdReady, stopCombinedPlayback]);

    const startAudioProcessing = useCallback(async () => {
        if (!isRecordingFeatureEnabled || isActuallyRecordingRef.current || typeof MediaStreamTrackProcessor === 'undefined') {
            if (typeof MediaStreamTrackProcessor === 'undefined') {
                alert("WebCodecs API (MediaStreamTrackProcessor) is not supported in this browser. Cannot start recording.");
                console.warn("[WebCodecs] MediaStreamTrackProcessor is not supported.");
            }
            if (isActuallyRecordingRef.current) {
                console.log("[WebCodecs] Audio processing is already active.");
            }
            if (!isRecordingFeatureEnabled) {
                console.log("[WebCodecs] Recording feature is disabled.");
            }
            return;
        }
        try {
            console.log("[WebCodecs] Attempting to start audio processing with desired settings...");
            const constraints: MediaStreamConstraints = {
                audio: {
                    sampleRate: { ideal: 44100 },    
                    noiseSuppression: true,          
                }
            };
            const userStream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = userStream;
            const track = userStream.getAudioTracks()[0];
            if (!track) {
                console.error("[WebCodecs] No audio track found in the stream.");
                alert("使用可能なマイクが見つかりませんでした。");
                if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
                return;
            }
            audioTrackRef.current = track;
            const trackSettings = track.getSettings();
            console.log(`[WebCodecs] Audio track settings obtained:`, trackSettings);
            if (trackSettings.sampleRate) {
                console.log(`[WebCodecs] Actual sampleRate of the track: ${trackSettings.sampleRate}Hz`);
                if (trackSettings.sampleRate !== 44100 && constraints.audio && typeof constraints.audio === 'object' && 'sampleRate' in constraints.audio && typeof constraints.audio.sampleRate === 'object' && constraints.audio.sampleRate && 'ideal' in constraints.audio.sampleRate && constraints.audio.sampleRate.ideal === 44100) {
                    console.warn(`[WebCodecs] Requested sampleRate ${constraints.audio.sampleRate.ideal}Hz, but got ${trackSettings.sampleRate}Hz.`);
                }
            }
            if (typeof trackSettings.noiseSuppression === 'boolean') { 
                console.log(`[WebCodecs] Actual noiseSuppression state: ${trackSettings.noiseSuppression}`);
                if (constraints.audio && typeof constraints.audio === 'object' && 'noiseSuppression' in constraints.audio && constraints.audio.noiseSuppression === true && trackSettings.noiseSuppression !== true) {
                    console.warn(`[WebCodecs] Requested noiseSuppression: true, but got ${trackSettings.noiseSuppression}. It might not be supported or controllable by the browser/hardware.`);
                }
            }
            audioFramesForCurrentMeasureRef.current = []; 
            const processor = new MediaStreamTrackProcessor({ track });
            audioFrameProcessorRef.current = processor;
            setIsActuallyRecording(true); 
            let shouldContinue = true;
            stopAudioProcessingRef.current = () => { 
                shouldContinue = false;
                console.log("[WebCodecs] stopAudioProcessingRef called, shouldContinue flag set to false.");
            };
            const reader = processor.readable.getReader();
            console.log("[WebCodecs] Audio frame reader obtained. Starting to read frames...");
            (async () => {
                try {
                    while (shouldContinue) {
                        const { value: frame, done } = await reader.read();
                        if (done) { 
                            console.log("[WebCodecs] Frame reading stream ended (done is true).");
                            if (frame) frame.close(); 
                            break;
                        }
                        if (!shouldContinue) { 
                            console.log("[WebCodecs] Frame reading loop explicitly stopped.");
                            if (frame) frame.close();
                            break;
                        }
                        if (frame) {
                            if (isActuallyRecordingRef.current) { 
                                audioFramesForCurrentMeasureRef.current.push(frame); 
                            } else {
                                frame.close(); 
                            }
                        }
                    }
                } catch (e) {
                    console.error("[WebCodecs] Error reading audio frames:", e);
                } finally {
                    console.log("[WebCodecs] Frame reading loop finished. Cleaning up reader...");
                    try {
                        if (reader && typeof reader.cancel === 'function') {
                           if (processor.readable.locked) { 
                               await reader.cancel();
                               console.log("[WebCodecs] Reader cancelled.");
                           }
                        }
                    } catch (e) {
                        console.warn("[WebCodecs] Error cancelling reader during cleanup:", e);
                    }
                }
            })();
        } catch (err) { 
            console.error("[WebCodecs] Error in startAudioProcessing:", err);
            setIsActuallyRecording(false); 
            if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
            audioTrackRef.current = null;
            let errorMessage = "録音の準備に失敗しました。";
            if (err instanceof Error) {
                switch (err.name) {
                    case "NotAllowedError": 
                    case "PermissionDeniedError": 
                        errorMessage = "マイクの使用が許可されていません。ブラウザの設定を確認してください。"; 
                        break;
                    case "NotFoundError": 
                        errorMessage = "使用可能なマイクが見つかりませんでした。マイクが接続されているか確認してください。";
                        break;
                    case "OverconstrainedError": 
                    case "ConstraintNotSatisfiedError": 
                        errorMessage = `要求された音声設定（サンプリングレート44100Hz、ノイズ抑制等）がマイクまたはブラウザでサポートされていません。詳細: ${err.message}`;
                        break;
                    default:
                        errorMessage = `録音の準備中にエラーが発生しました: ${err.message}`;
                }
            }
            alert(errorMessage); 
        }
    }, [isRecordingFeatureEnabled, setIsActuallyRecording]); 

    const stopAudioProcessing = useCallback(() => {
        console.log("[WebCodecs] Attempting to stop audio processing...");
        if (stopAudioProcessingRef.current) {
            stopAudioProcessingRef.current(); 
            stopAudioProcessingRef.current = null;
        }
        // audioFrameProcessorRef.current?.readable のクローズ処理はリーダー側で行う
        audioFrameProcessorRef.current = null;
        if (audioTrackRef.current) {
            audioTrackRef.current.stop(); 
            audioTrackRef.current = null;
        }
        if (streamRef.current) {
            // streamRef.current.getTracks().forEach(t => t.stop()); // audioTrackRef.stop()で十分
            streamRef.current = null;
        }
        if (audioFramesForCurrentMeasureRef.current.length > 0 && activeMeasureNumberRef_mainDisplay.current > 0) {
            console.log(`[WebCodecs] Processing ${audioFramesForCurrentMeasureRef.current.length} remaining audio frames on stop.`);
            processAudioFramesForMeasure(
                activeMeasureNumberRef_mainDisplay.current, 
                [...clipsForCurrentMeasureRef_mainDisplay.current],
                [...audioFramesForCurrentMeasureRef.current]
            );
        }
        audioFramesForCurrentMeasureRef.current = []; 
        setIsActuallyRecording(false);
        console.log("[WebCodecs] Audio processing stopped.");
    }, [processAudioFramesForMeasure]); 

    const handleToggleRecording = useCallback(() => {
        if (!isRecordingFeatureEnabled) return;
        if (isActuallyRecordingRef.current) {
            stopAudioProcessing();
        } else {
            startAudioProcessing();
        }
    }, [isRecordingFeatureEnabled, startAudioProcessing, stopAudioProcessing]);
    
    useEffect(() => {
        return () => {
            if (isActuallyRecordingRef.current) {
                stopAudioProcessing();
            } else { 
                 if (stopAudioProcessingRef.current) stopAudioProcessingRef.current(); 
                 if (audioTrackRef.current) audioTrackRef.current.stop();
                 if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            }
            if (mainAudioContextRef.current && mainAudioContextRef.current.state !== 'closed') {
                mainAudioContextRef.current.close().catch(e => {console.warn("Error closing mainAudioContext on unmount", e)});
            }
            if (accompanimentAudioContextRef.current && accompanimentAudioContextRef.current.state !== 'closed') {
                accompanimentAudioContextRef.current.close().catch(e => {console.warn("Error closing accompanimentAudioContext on unmount", e)});
            }
        };
    }, [stopAudioProcessing]); 
    
    const handlePlayPause = useCallback(() => {
        if (isPlayingRef.current) {
            stopCombinedPlayback();
        } else {
            startCombinedPlayback(getCurrentBpm());
        }
    }, [stopCombinedPlayback, startCombinedPlayback, getCurrentBpm]);

    const togglePlaybackStyle = useCallback(() => {
        if (isPlayingRef.current) stopCombinedPlayback();
        setPlaybackStyle(prevStyle => {
            const hasAccompaniment = isPlaybackOsmdReady && !!accompanimentXml;
            if (prevStyle === 'score') return 'metronome';
            if (prevStyle === 'metronome') return hasAccompaniment ? 'accompaniment' : 'score';
            if (prevStyle === 'accompaniment') return 'score';
            return 'score';
        });
    }, [isPlaybackOsmdReady, accompanimentXml, stopCombinedPlayback]);

    const getPlaybackStyleButtonContent = useCallback((currentStyle: PlaybackStyle, accReady: boolean): { icon: JSX.Element; text: string } => {
        if (currentStyle === 'score') return { icon: <MdQueueMusic size="1.8em" />, text: "楽譜" };
        if (currentStyle === 'metronome') return { icon: <TbMetronome size="1.8em" />, text: "メトロノーム" };
        if (currentStyle === 'accompaniment') return { icon: accReady ? <LuPiano size="1.8em" /> : <MdQueueMusic size="1.8em" />, text: accReady ? "伴奏" : "楽譜" };
        return { icon: <IoMusicalNotesOutline size="1.8em" />, text: "スタイル" }; // Fallback
    }, []);

    const currentButtonContent = getPlaybackStyleButtonContent(playbackStyle, isPlaybackOsmdReady && !!accompanimentXml);
    
    const handleBpmChangeWithStop = useCallback((doUp: boolean) => {
        if (isPlayingRef.current) stopCombinedPlayback(); 
        handlebpmChangeCallback(doUp);
    }, [handlebpmChangeCallback, stopCombinedPlayback]);

    const handleDifficultyChangeWithStop = useCallback((newDiff: Difficulty) => {
        if (isPlayingRef.current) stopCombinedPlayback(); 
        onDifficultyChange(newDiff);
    }, [onDifficultyChange, stopCombinedPlayback]);

    useEffect(() => {
        if (isPlaying && displayStoppedRef.current && accompanimentStoppedRef.current) {
            if(isPlayingRef.current) setIsPlaying(false);
        }
    }, [isPlaying]);

    // スタイル定義
    const footerStyle: React.CSSProperties = {
        backgroundColor: '#93B8DC',
        padding: '10px 15px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around', // space-between から space-around に変更して少し余裕を持たせる
        color: '#FFFFFF', 
        borderRadius: '8px', 
        boxShadow: '0 -2px 5px rgba(0,0,0,0.1)', 
        position: 'fixed', 
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000, 
    };

    const controlGroupStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '12px', // 少し狭く
    };
    
    const iconButtonStyle: React.CSSProperties = {
        background: 'none',
        border: 'none',
        color: '#FFFFFF', 
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '50%', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s ease, transform 0.1s ease', // transform追加
    };
    
    const iconButtonHoverActiveStyle: React.CSSProperties = { // ホバー時とアクティブ時のスタイル
        // backgroundColor: 'rgba(255, 255, 255, 0.2)',
    };
    const iconButtonPressedStyle: React.CSSProperties = { // 押下時のスタイル
        transform: 'scale(0.9)',
    };


    const textStyle: React.CSSProperties = {
        fontSize: '0.9em', // 少し小さく
        fontWeight: 'bold',
        minWidth: '45px', // 少し小さく
        textAlign: 'center',
        userSelect: 'none', // テキスト選択不可
    };

    const getDisabledStyle = (disabled: boolean): React.CSSProperties => ({
        ...iconButtonStyle,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
    });

    const [activeButton, setActiveButton] = useState<string | null>(null);
    const [hoverStates, setHoverStates] = useState<Record<string, boolean>>({});

    const handleMouseDown = (key: string) => setActiveButton(key);
    const handleMouseUp = () => setActiveButton(null);
    const handleMouseEnter = (key: string) => setHoverStates(prev => ({ ...prev, [key]: true }));
    const handleMouseLeave = (key: string) => {
        setHoverStates(prev => ({ ...prev, [key]: false }));
        setActiveButton(null); // ホバーが外れたら押下状態も解除
    };

    const getCombinedButtonStyle = (key: string, isDisabled: boolean) => {
        let style = getDisabledStyle(isDisabled);
        if (!isDisabled && hoverStates[key]) {
            style = {...style, ...iconButtonHoverActiveStyle};
        }
        if (!isDisabled && activeButton === key) {
            style = {...style, ...iconButtonPressedStyle};
        }
        return style;
    }


    return (
        <>
            <div ref={playbackOsmdContainerRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}/>
            
            <div style={footerStyle}>
                <div style={controlGroupStyle}>
                    <button
                        style={getCombinedButtonStyle('bpmDown', (isPlaying || isActuallyRecording) && getCurrentBpm() <= (10 - basebpm + basebpm))}
                        onClick={() => handleBpmChangeWithStop(false)}
                        disabled={(isPlaying || isActuallyRecording) && getCurrentBpm() <= (10 - basebpm + basebpm)}
                        onMouseDown={() => handleMouseDown('bpmDown')}
                        onMouseUp={handleMouseUp}
                        onMouseEnter={() => handleMouseEnter('bpmDown')}
                        onMouseLeave={() => handleMouseLeave('bpmDown')}
                        title="BPMを下げる"
                    >
                        <IoPlaySkipBackSharp size="1.8em" />
                    </button>
                    <span style={textStyle}>{getCurrentBpm()}bpm</span>
                    <button
                        style={getCombinedButtonStyle('bpmUp', isPlaying || isActuallyRecording)}
                        onClick={() => handleBpmChangeWithStop(true)}
                        disabled={isPlaying || isActuallyRecording}
                        onMouseDown={() => handleMouseDown('bpmUp')}
                        onMouseUp={handleMouseUp}
                        onMouseEnter={() => handleMouseEnter('bpmUp')}
                        onMouseLeave={() => handleMouseLeave('bpmUp')}
                        title="BPMを上げる"
                    >
                        <IoPlaySkipForwardSharp size="1.8em" />
                    </button>
                </div>

                <div style={controlGroupStyle}>
                    <button
                        style={activeButton === 'playPause' ? {...iconButtonStyle, ...iconButtonPressedStyle, transform: 'scale(1.1)'} : {...iconButtonStyle, transform: 'scale(1.2)'} } // 押下時は少し小さく、通常時は大きく
                        onClick={handlePlayPause}
                        onMouseDown={() => handleMouseDown('playPause')}
                        onMouseUp={handleMouseUp}
                        onMouseEnter={() => handleMouseEnter('playPause')} // ホバーは任意
                        onMouseLeave={() => handleMouseLeave('playPause')}
                        title={isPlaying ? "停止" : "再生"}
                    >
                        {isPlaying ? <IoPauseSharp size="2.2em" /> : <IoPlaySharp size="2.2em" />}
                    </button>
                    <button 
                        style={getCombinedButtonStyle('record', isPlaying || !isRecordingFeatureEnabled || typeof MediaStreamTrackProcessor === 'undefined')}
                        onClick={handleToggleRecording} 
                        disabled={isPlaying || !isRecordingFeatureEnabled || typeof MediaStreamTrackProcessor === 'undefined'}
                        onMouseDown={() => handleMouseDown('record')}
                        onMouseUp={handleMouseUp}
                        onMouseEnter={() => handleMouseEnter('record')}
                        onMouseLeave={() => handleMouseLeave('record')}
                        title={isActuallyRecording ? "録音停止" : "録音開始"}
                    >
                        {isActuallyRecording ? <IoStopCircleOutline size="1.9em" color="#FF5C5C" /> : <IoMicOutline size="1.9em" />}
                    </button>
                </div>
                
                <div style={controlGroupStyle}>
                     <button 
                        style={getCombinedButtonStyle('playbackStyle', isPlaying || isActuallyRecording)}
                        onClick={togglePlaybackStyle} 
                        disabled={isPlaying || isActuallyRecording}
                        onMouseDown={() => handleMouseDown('playbackStyle')}
                        onMouseUp={handleMouseUp}
                        onMouseEnter={() => handleMouseEnter('playbackStyle')}
                        onMouseLeave={() => handleMouseLeave('playbackStyle')}
                        title={currentButtonContent.text}
                    >
                        {currentButtonContent.icon}
                    </button>
                    <button
                        style={getCombinedButtonStyle('diffDown', difficulty === 0 || isPlaying || isActuallyRecording)}
                        onClick={() => handleDifficultyChangeWithStop(Math.max(0, difficulty - 1) as Difficulty)}
                        disabled={difficulty === 0 || isPlaying || isActuallyRecording}
                        onMouseDown={() => handleMouseDown('diffDown')}
                        onMouseUp={handleMouseUp}
                        onMouseEnter={() => handleMouseEnter('diffDown')}
                        onMouseLeave={() => handleMouseLeave('diffDown')}
                        title="難易度を下げる"
                    >
                        <FaChevronLeft size="1.5em" />
                    </button>
                    <span style={{...textStyle, minWidth: '35px'}}>
                        {difficulty === 0 ? "Auto" : `Lv${difficulty}`}
                    </span>
                    <button
                        style={getCombinedButtonStyle('diffUp', difficulty === 5 || isPlaying || isActuallyRecording)}
                        onClick={() => handleDifficultyChangeWithStop(Math.min(5, difficulty + 1) as Difficulty)}
                        disabled={difficulty === 5 || isPlaying || isActuallyRecording}
                        onMouseDown={() => handleMouseDown('diffUp')}
                        onMouseUp={handleMouseUp}
                        onMouseEnter={() => handleMouseEnter('diffUp')}
                        onMouseLeave={() => handleMouseLeave('diffUp')}
                        title="難易度を上げる"
                    >
                        <FaChevronRight size="1.5em" />
                    </button>
                </div>
            </div>
            {/* メインコンテンツがフッターに隠れないようにするためのプレースホルダー。
            実際のアプリでは、このOSMDPlayerコンポーネントの親、またはレイアウトコンポーネントで
            メインコンテンツ領域に適切なpadding-bottom（フッターの高さ分）を設定してください。
            例: <div style={{ paddingBottom: '70px' }}> ... アプリのメインコンテンツ ... </div>
            フッターの高さは、paddingや要素のサイズによって変わるので、実測値を元に調整してください。
            */}
        </>
    );
}