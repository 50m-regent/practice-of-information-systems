import React, { useEffect, useRef, useState, useCallback } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Difficulty } from '../types/types'; // 適切な型のパスを指定してください
import { IoMusicalNotesOutline } from 'react-icons/io5';
import { MdQueueMusic } from "react-icons/md";
import { LuPiano } from "react-icons/lu";
import { TbMetronome } from 'react-icons/tb';

// WebCodecs API の型定義 (グローバルに存在しない場合、手動で追加するか @types/web を利用)
// この例では主要なものだけを簡略的に定義していますが、実際にはより完全な型定義が必要です。
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
    new (init: { track: MediaStreamTrack }): MediaStreamTrackProcessor<AudioData>; // AudioDataを指定
  };
  // 必要に応じて AudioDecoder, EncodedAudioChunk などの型も定義
}


interface OSMDPlayerProps {
  osmd: React.RefObject<OpenSheetMusicDisplay>;
  difficulty: Difficulty;
  accompanimentXml?: string | null;
  basebpm: number;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onProficiencyUpdate: (newProficiency: number) => void;
  getMeasureDifficulty: (measurenum: number)=> Difficulty;
  onRequestScrollToMeasure: (measureNumber: number, smooth?: boolean) => void;
}

type PlaybackStyle = 'score' | 'metronome' | 'accompaniment';

const getDummyProficiency = (): number => {
    return Math.floor(Math.random() * 10) + 1;
};

const MIN_TIMEOUT_DELAY = 15;
const NEXT_STEP_DELAY = 0;
// RECORDER_TIMESLICE は MediaRecorder を使わないため不要になる

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
    const [isActuallyRecording, setIsActuallyRecording] = useState(false); // WebCodecs API での録音状態
    const isActuallyRecordingRef = useRef(isActuallyRecording);
    useEffect(() => { isActuallyRecordingRef.current = isActuallyRecording; }, [isActuallyRecording]);
    
    // MediaRecorder 関連の ref は不要になる
    // const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    // const audioChunksRef = useRef<Blob[]>([]);
    
    const streamRef = useRef<MediaStream | null>(null);
    const audioTrackRef = useRef<MediaStreamTrack | null>(null);
    const audioFrameProcessorRef = useRef<MediaStreamTrackProcessor<AudioData> | null>(null);
    const audioFramesForCurrentMeasureRef = useRef<AudioData[]>([]); // 現在の小節の AudioData フレームを保持
    const stopAudioProcessingRef = useRef<(() => void) | null>(null); // フレーム処理ループを停止する関数


    const [playbackStyle, setPlaybackStyle] = useState<PlaybackStyle>('accompaniment');

    useEffect(() => {
        // WebCodecs APIが利用可能かチェック (簡易的)
        if (typeof MediaStreamTrackProcessor === 'undefined') {
            console.warn("WebCodecs API (MediaStreamTrackProcessor) is not supported in this browser.");
            setIsRecordingFeatureEnabled(false); // サポートされていなければ録音機能を無効化
        }
    }, []);


    useEffect(() => {
        // (OSMD伴奏部分のuseEffectは変更なし)
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
        // (変更なし)
        if (bpm <= 0) return 0;
        const quarterNoteMs = (60 / bpm) * 1000;
        const wholeNoteMs = quarterNoteMs * 4;
        return osmdRealValue * wholeNoteMs;
    },[]);

    const midiNoteNumberToFrequency = useCallback((midiNoteNumber: number): number => {
        // (変更なし)
        return 440 * Math.pow(2, (midiNoteNumber - 69) / 12);
    },[]);

    const playBeepGeneric = useCallback((audioCtx: AudioContext | null, frequency: number, durationMs: number) => {
        // (変更なし)
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
        // (変更なし)
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

    // ========== WebCodecs API 用のデータ処理関数 ==========
    const processAudioFramesForMeasure = useCallback(async (
        measureNumber: number,
        musicClips: [number, number][], // 楽譜情報（これは変わらず）
        audioFrames: AudioData[] // Blob[] の代わりに AudioData[] を受け取る
    ) => {
        console.log(`[WebCodecs Data] Processing for 小節 ${measureNumber} (n-1):`);
        console.log(`  ├─ musicClipRef:`, musicClips);

        if (!isActuallyRecordingRef.current && audioFrames.length === 0) { // 録音中でなく、かつフレームもなければ何もしない
            console.log(`  └─ AudioFrames: (録音機能停止中 or no frames for this segment)`);
            return;
        }
        if (audioFrames.length === 0) {
            console.log(`  └─ AudioFrames: (この区間の音声フレームなし)`);
            return;
        }
        
        console.log(`  └─ Processing ${audioFrames.length} AudioData frame(s) for measure ${measureNumber}:`);

        try {
            let totalSamples = 0;
            let sampleRate = 0;
            let numberOfChannels = 0;

            // 全フレームの総サンプル数を計算し、基本情報を取得
            for (const frame of audioFrames) {
                totalSamples += frame.numberOfFrames * frame.numberOfChannels; //
                if (sampleRate === 0) sampleRate = frame.sampleRate;
                if (numberOfChannels === 0) numberOfChannels = frame.numberOfChannels;
                 // 全てのフレームが同じサンプルレート、チャンネル数であることを期待
                if (frame.sampleRate !== sampleRate || frame.numberOfChannels !== numberOfChannels) {
                    console.warn("[WebCodecs Data] Inconsistent audio frame properties (sampleRate/channels).");
                    // エラー処理または最初のフレームのプロパティを優先する
                }
            }
            
            if (totalSamples === 0) {
                console.log(`      └─ No actual samples in received AudioData frames.`);
                audioFrames.forEach(frame => frame.close()); // フレームを解放
                return;
            }

            // ここでは簡単のため、最初のチャンネル (channel 0) のデータを連結することを想定
            // また、AudioData の format が 'f32-planar' または 'f32' であると仮定
            // 実際の copyTo の挙動は format に依存するため、より堅牢な処理が必要
            const combinedPcmData = new Float32Array(totalSamples / numberOfChannels); // 1チャンネル分のデータサイズ
            let currentOffset = 0;

            for (const frame of audioFrames) {
                // AudioDataからPCMデータをコピー
                // 'f32-planar' の場合、各チャンネルは別のプレーンにある
                // 'f32' の場合、データはインターリーブされている
                // ここでは最も一般的なケースとして、モノラル (numberOfChannels=1) または
                // ステレオの最初のチャンネル (planeIndex=0) を想定
                const planeIndex = 0; // 最初のチャンネル
                const frameDataSize = frame.numberOfFrames; // 1チャンネルあたりのフレーム数
                
                // 一時的なバッファを作成してコピー
                // AudioDataの仕様では、destinationはTypedArrayまたはDataView
                // frame.allocationSize({ planeIndex }) で必要なサイズを取得できるが、
                // numberOfFrames * BYTES_PER_ELEMENT (Float32Array.BYTES_PER_ELEMENT) でも計算可能
                const tempFrameArray = new Float32Array(frameDataSize);
                
                // frame.format に応じて copyTo の挙動が変わるので注意
                // 例: 'f32-planar' で planeIndex を指定するとそのチャンネルのデータのみ
                // 例: 'f32' (インターリーブ)の場合、planeIndex は通常0で全チャンネルデータがコピーされる
                //      その場合は、後で手動で目的のチャンネルを抽出する必要がある。
                //      ここでは、frame.numberOfChannels が 1 であるか、
                //      または frame.copyTo が planeIndex=0 で最初のチャンネルのみを tempFrameArray にコピーしてくれると仮定
                //      より正確には、frame.format を確認して分岐処理が必要
                
                if (frame.format === 'f32-planar' || frame.format === 'f32' || frame.format === 'S16' || frame.format === 'S32' || frame.format === 'U8') { // 既知のフォーマットか
                    // 実際には numberOfChannels と format を見て適切に処理
                    // 例として、モノラル or 最初のチャンネルを抽出
                    const singleChannelFrameData = new Float32Array(frame.numberOfFrames);
                    try {
                        // copyToの第2引数planeIndexはplanarフォーマットで意味を持つ
                        // インターリーブ形式('f32')の場合、通常planeIndexは0で全チャンネルデータがコピーされる。
                        // その後、手動でチャンネル分離が必要。
                        // ここでは簡略化のため、1チャンネル分のデータが取れると仮定
                        if(frame.numberOfChannels === 1) {
                             frame.copyTo(singleChannelFrameData, { planeIndex: 0, frameCount: frame.numberOfFrames });
                        } else if (frame.numberOfChannels > 1 && (frame.format === 'f32-planar')) {
                            // 'f32-planar' なら指定プレーンのみコピー
                            frame.copyTo(singleChannelFrameData, { planeIndex: 0, frameCount: frame.numberOfFrames });
                        } else if (frame.numberOfChannels > 1 && frame.format === 'f32') {
                            // 'f32' (インターリーブ) の場合のチャンネル抽出 (例: 最初のチャンネル)
                            const interleavedData = new Float32Array(frame.numberOfFrames * frame.numberOfChannels);
                            frame.copyTo(interleavedData, { planeIndex: 0, frameCount: frame.numberOfFrames });
                            for (let i = 0; i < frame.numberOfFrames; i++) {
                                singleChannelFrameData[i] = interleavedData[i * frame.numberOfChannels + 0]; // 0番目のチャンネル
                            }
                        } else {
                            console.warn(`[WebCodecs Data] Unsupported channel/format combination for direct extraction: ${frame.format}, channels: ${frame.numberOfChannels}`);
                            // このフレームはスキップするか、エラー処理
                            frame.close();
                            continue;
                        }

                        combinedPcmData.set(singleChannelFrameData, currentOffset);
                        currentOffset += singleChannelFrameData.length;

                    } catch (e) {
                        console.error("[WebCodecs Data] Error copying data from AudioData frame:", e, frame);
                    }

                } else {
                     console.warn(`[WebCodecs Data] Unknown or unhandled AudioData format: ${frame.format}. Skipping frame.`);
                }
                frame.close(); // ★重要: AudioDataフレームは使用後に必ずcloseする
            }
            
            const finalPcmData = combinedPcmData.slice(0, currentOffset); // 実際に書き込まれた部分だけを抽出

            console.log(`      ├─ Combined PCM Data: Sample Rate: ${sampleRate}Hz, Channels (processed): 1, Length: ${finalPcmData.length} samples`);
            const samplesToDisplay = 100;
            console.log(`        └─ First ${Math.min(samplesToDisplay, finalPcmData.length)} Samples:`, finalPcmData.slice(0, samplesToDisplay));

        } catch (error) {
            console.error(`[WebCodecs Data] Error processing AudioData frames for measure ${measureNumber}:`, error);
            // エラーが発生しても、渡されたフレームは解放する
            audioFrames.forEach(frame => {
                try { frame.close(); } catch (e) { /* ignore close error */ }
            });
        }
    }, []); // 依存配列: isActuallyRecordingRef は.currentでアクセスするため不要


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
        audioFramesForCurrentMeasureRef.current = []; // AudioDataバッファもリセット

        if (cursor.iterator.CurrentMeasure) {
            activeMeasureNumberRef_mainDisplay.current = cursor.iterator.CurrentMeasure.MeasureNumber;
        }

        const step = () => {
            if (displayStoppedRef.current) { // 再生停止時
                if (cursor) cursor.hide();
                if (activeMeasureNumberRef_mainDisplay.current > 0) {
                    // 最後に残ったフレームを処理
                    processAudioFramesForMeasure(
                        activeMeasureNumberRef_mainDisplay.current,
                        [...clipsForCurrentMeasureRef_mainDisplay.current],
                        [...audioFramesForCurrentMeasureRef.current] // 最後に残ったフレーム
                    );
                    audioFramesForCurrentMeasureRef.current = []; // クリア
                }
                return;
            }

            if (cursor.iterator.endReached) { // 最後まで到達
                if (activeMeasureNumberRef_mainDisplay.current > 0) {
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
                // 小節が変わったので、前の小節のデータを処理
                if (activeMeasureNumberRef_mainDisplay.current > 0) { 
                    processAudioFramesForMeasure(
                        activeMeasureNumberRef_mainDisplay.current,
                        [...clipsForCurrentMeasureRef_mainDisplay.current],
                        [...audioFramesForCurrentMeasureRef.current] // 収集したフレーム
                    );
                }
                // 次の小節のためにリセット
                activeMeasureNumberRef_mainDisplay.current = currentIteratorMeasure.MeasureNumber;
                clipsForCurrentMeasureRef_mainDisplay.current = [];
                audioFramesForCurrentMeasureRef.current = []; // AudioDataバッファもリセット
            }

            // (OSMDカーソルを進めるロジックは変更なし)
            const voiceEntries = cursor.iterator.CurrentVoiceEntries;
            let durationMs = 0;
            if (voiceEntries.length === 0) { durationMs = 50; } 
            else {
                const noteDurations = voiceEntries.flatMap(entry => entry.Notes.map(note => note.length.realValue));
                const longestDurationRealValue = noteDurations.length > 0 ? Math.max(0, ...noteDurations) : 0;
                durationMs = getNoteDurationMs(longestDurationRealValue, bpm);
                if (durationMs > 0 && activeMeasureNumberRef_mainDisplay.current > 0) {
                    voiceEntries.forEach(vEntry => vEntry.Notes.forEach(note => {
                        const freq = note.pitch ? midiNoteNumberToFrequency(note.pitch.halfTone) : 0;
                        clipsForCurrentMeasureRef_mainDisplay.current.push([freq, durationMs]);
                         if ((!mainAudioContextRef.current || mainAudioContextRef.current.state === 'closed') && freq === 0 && durationMs > 0) {
                            try { mainAudioContextRef.current = new AudioContext(); } catch(e) {}
                         }
                    }));
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
    }, [osmd, getNoteDurationMs, midiNoteNumberToFrequency, onRequestScrollToMeasure, processAudioFramesForMeasure]); // processAudioFramesForMeasure を依存配列に追加


    const playOSMDByCursor = useCallback((bpm: number) => {
        // (OSMDやメトロノームの再生ロジックは変更なし)
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
        // (変更なし)
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
        // (変更なし)
        if (isPlayingRef.current) stopCombinedPlayback();
        displayStoppedRef.current = false; accompanimentStoppedRef.current = false; scoreAudioStoppedRef.current = false;
        const mainSheetOk = !!osmd.current?.Sheet && !!osmd.current?.cursor;
        const accOk = playbackStyle === 'accompaniment' && isPlaybackOsmdReady && !!playbackOsmdRef.current?.Sheet && !!playbackOsmdRef.current?.cursor;
        let runMain = false, runAudio = false;
        if (playbackStyle === 'score') { if (mainSheetOk) { runMain = true; runAudio = true; } }
        else if (playbackStyle === 'metronome') { if (mainSheetOk) runMain = true; runAudio = true; } // メトロノームも音声を再生
        else if (playbackStyle === 'accompaniment') { if (mainSheetOk) runMain = true; if (accOk) runAudio = true; }
        if (!runMain && !runAudio && playbackStyle !== 'metronome') { setIsPlaying(false); return; }
        if (playbackStyle === 'metronome' && !runAudio && mainSheetOk) runAudio = true; // メトロノーム再生時は音声を必ず再生
        
        setIsPlaying(true);
        if (runAudio) playOSMDByCursor(bpmToPlay); 
        else { accompanimentStoppedRef.current = true; scoreAudioStoppedRef.current = true; }
        if (runMain) mainDisplayOSMDByCursor(bpmToPlay); 
        else displayStoppedRef.current = true;
    }, [ mainDisplayOSMDByCursor, playOSMDByCursor, setIsPlaying, osmd, playbackStyle, isPlaybackOsmdReady, stopCombinedPlayback]);

    // ========== WebCodecs API 用の録音開始処理 ==========
    const startAudioProcessing = useCallback(async () => {
        // 1. 機能フラグ、録音状態、APIサポートのチェック
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
            
            // 2. getUserMedia の制約定義
            const constraints: MediaStreamConstraints = {
                audio: {
                    sampleRate: { exact : 48000 },    // 理想的なサンプリングレートとして44100Hz
                    // noiseSuppression: true,          // ★ノイズ抑制を有効にする
                    // echoCancellation: false,      // エコーキャンセレーション (楽器録音ではオフ推奨が多い)
                    // autoGainControl: false,       // 自動ゲインコントロール (楽器録音ではオフ推奨が多い)
                    // channelCount: 1,             // モノラル録音を強制する場合
                }
            };

            // 3. メディアストリームの取得
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

            // 4. 実際に適用されたトラック設定の確認とログ出力
            const trackSettings = track.getSettings();
            console.log(`[WebCodecs] Audio track settings obtained:`, trackSettings);
            if (trackSettings.sampleRate) {
                console.log(`[WebCodecs] Actual sampleRate of the track: ${trackSettings.sampleRate}Hz`);
                if (trackSettings.sampleRate !== 44100 && constraints.audio && typeof constraints.audio === 'object' && 'sampleRate' in constraints.audio && typeof constraints.audio.sampleRate === 'object' && constraints.audio.sampleRate && 'ideal' in constraints.audio.sampleRate && constraints.audio.sampleRate.ideal === 44100) {
                    console.warn(`[WebCodecs] Requested sampleRate ${constraints.audio.sampleRate.ideal}Hz, but got ${trackSettings.sampleRate}Hz.`);
                    // 必要であればユーザーに通知
                    // alert(`要求したサンプリングレート44100Hzは利用できず、${trackSettings.sampleRate}Hzが使用されます。`);
                }
            }
            if (typeof trackSettings.noiseSuppression === 'boolean') { // boolean型か確認
                console.log(`[WebCodecs] Actual noiseSuppression state: ${trackSettings.noiseSuppression}`);
                if (constraints.audio && typeof constraints.audio === 'object' && 'noiseSuppression' in constraints.audio && constraints.audio.noiseSuppression === true && trackSettings.noiseSuppression !== true) {
                    console.warn(`[WebCodecs] Requested noiseSuppression: true, but got ${trackSettings.noiseSuppression}. It might not be supported or controllable by the browser/hardware.`);
                }
            }
            // 同様に echoCancellation, autoGainControl の実際の値も確認できます。

            // 5. AudioDataフレームバッファのクリア
            audioFramesForCurrentMeasureRef.current = []; 

            // 6. MediaStreamTrackProcessor の初期化
            const processor = new MediaStreamTrackProcessor({ track });
            audioFrameProcessorRef.current = processor;
            
            // 7. 録音状態をtrueに設定
            setIsActuallyRecording(true); 

            // 8. フレーム読み取りループ制御用フラグと停止関数の準備
            let shouldContinue = true;
            stopAudioProcessingRef.current = () => { 
                shouldContinue = false;
                console.log("[WebCodecs] stopAudioProcessingRef called, shouldContinue flag set to false.");
            };

            // 9. ReadableStreamリーダーの取得とログ
            const reader = processor.readable.getReader();
            console.log("[WebCodecs] Audio frame reader obtained. Starting to read frames...");

            // 10. 非同期フレーム読み取りループ
            (async () => {
                try {
                    while (shouldContinue) {
                        const { value: frame, done } = await reader.read();
                        if (done) { // ストリームが終了した場合
                            console.log("[WebCodecs] Frame reading stream ended (done is true).");
                            if (frame) frame.close(); // 最後に読み取ったフレームがあれば解放
                            break;
                        }
                        if (!shouldContinue) { // 外部から停止が要求された場合
                            console.log("[WebCodecs] Frame reading loop explicitly stopped.");
                            if (frame) frame.close();
                            break;
                        }

                        if (frame) {
                            if (isActuallyRecordingRef.current) { // 録音中のみフレームをバッファに追加
                                audioFramesForCurrentMeasureRef.current.push(frame); 
                            } else {
                                frame.close(); // 録音中でなければフレームをすぐに解放
                            }
                        }
                    }
                } catch (e) {
                    console.error("[WebCodecs] Error reading audio frames:", e);
                } finally {
                    console.log("[WebCodecs] Frame reading loop finished. Cleaning up reader...");
                    try {
                        // リーダーがまだ解放されていなければキャンセル/解放する
                        if (reader && typeof reader.cancel === 'function') {
                        if (processor.readable.locked) { // readable がロックされているか確認
                            // reader.cancel() はストリーム自体をエラー状態にする可能性があるため、
                            // releaseLock() の方が適切な場合がある。
                            // ただし、ループを抜けるためにキャンセルが意図的なら cancel()。
                            // shouldContinueがfalseなら意図的な停止なので、cancelで良い。
                            await reader.cancel();
                            console.log("[WebCodecs] Reader cancelled.");
                        }
                        }
                    } catch (e) {
                        console.warn("[WebCodecs] Error cancelling reader during cleanup:", e);
                    }
                }
            })();

        } catch (err) { // getUserMedia またはセットアップ中のエラー
            console.error("[WebCodecs] Error in startAudioProcessing:", err);
            setIsActuallyRecording(false); // 念のため録音状態をfalseに
            if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
            audioTrackRef.current = null;
            
            let errorMessage = "録音の準備に失敗しました。";
            // ErrorオブジェクトかDOMExceptionかを確認してメッセージを組み立てる
            if (err instanceof Error) {
                switch (err.name) {
                    case "NotAllowedError": // DOMException
                    case "PermissionDeniedError": // DOMException (Firefox)
                        errorMessage = "マイクの使用が許可されていません。ブラウザの設定を確認してください。"; 
                        break;
                    case "NotFoundError": // DOMException
                        errorMessage = "使用可能なマイクが見つかりませんでした。マイクが接続されているか確認してください。";
                        break;
                    case "OverconstrainedError": // DOMException
                    case "ConstraintNotSatisfiedError": // DOMException
                        errorMessage = `要求された音声設定（サンプリングレート44100Hz、ノイズ抑制等）がマイクまたはブラウザでサポートされていません。詳細: ${err.message}`;
                        break;
                    default:
                        errorMessage = `録音の準備中にエラーが発生しました: ${err.message}`;
                }
            }
            alert(errorMessage); 
        }
    }, [isRecordingFeatureEnabled, setIsActuallyRecording]); // isActuallyRecordingRef は ref なので依存配列に不要

    // ========== WebCodecs API 用の録音停止処理 ==========
    const stopAudioProcessing = useCallback(() => {
        console.log("[WebCodecs] Attempting to stop audio processing...");
        if (stopAudioProcessingRef.current) {
            stopAudioProcessingRef.current(); // フレーム読み取りループを停止させる
            stopAudioProcessingRef.current = null;
        }

        if (audioFrameProcessorRef.current?.readable) {
             // リーダーが解放されるのを待つか、強制的にキャンセルする
             // 上のループ内でreader.cancel()しているので、ここでは不要かもしれない
             // audioFrameProcessorRef.current.readable.cancel().catch(e => console.warn("Error cancelling readable stream on stop:", e));
        }
        audioFrameProcessorRef.current = null;

        if (audioTrackRef.current) {
            audioTrackRef.current.stop(); // マイクのトラックを停止
            audioTrackRef.current = null;
        }
        if (streamRef.current) {
            // streamRef.current.getTracks().forEach(track => track.stop()); // audioTrackRef.stop()で十分なはず
            streamRef.current = null;
        }
        
        // 最後に残っているフレームを処理する
        if (audioFramesForCurrentMeasureRef.current.length > 0 && activeMeasureNumberRef_mainDisplay.current > 0) {
            console.log(`[WebCodecs] Processing ${audioFramesForCurrentMeasureRef.current.length} remaining audio frames on stop.`);
            processAudioFramesForMeasure(
                activeMeasureNumberRef_mainDisplay.current, // 現在の（最後の）小節番号
                [...clipsForCurrentMeasureRef_mainDisplay.current],
                [...audioFramesForCurrentMeasureRef.current]
            );
        }
        audioFramesForCurrentMeasureRef.current = []; // バッファをクリア

        setIsActuallyRecording(false);
        console.log("[WebCodecs] Audio processing stopped.");
    }, [processAudioFramesForMeasure]); // activeMeasureNumberRef_mainDisplay, clipsForCurrentMeasureRef_mainDisplay はrefなので依存配列に不要

    const handleToggleRecording = useCallback(() => {
        if (!isRecordingFeatureEnabled) return;
        if (isActuallyRecordingRef.current) {
            stopAudioProcessing();
        } else {
            startAudioProcessing();
        }
    }, [isRecordingFeatureEnabled, startAudioProcessing, stopAudioProcessing]);
    
    useEffect(() => {
        // コンポーネントアンマウント時のクリーンアップ
        return () => {
            if (isActuallyRecordingRef.current) {
                stopAudioProcessing();
            } else { // 録音中でなくても、ストリームやトラックが残っている可能性を考慮
                 if (stopAudioProcessingRef.current) stopAudioProcessingRef.current(); // ループ停止
                 if (audioTrackRef.current) audioTrackRef.current.stop();
                 if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            }

            // AudioContextのクリーンアップ (変更なし)
            if (mainAudioContextRef.current && mainAudioContextRef.current.state !== 'closed') {
                mainAudioContextRef.current.close().catch(e => {});
            }
            if (accompanimentAudioContextRef.current && accompanimentAudioContextRef.current.state !== 'closed') {
                accompanimentAudioContextRef.current.close().catch(e => {});
            }
        };
    }, [stopAudioProcessing]); // stopAudioProcessing は useCallback で安定化
    
    const handlePlayPause = useCallback(() => {
        // (再生ロジックと録音開始/停止の連携は要件に応じて調整)
        // 例えば、再生開始時に自動で録音を開始し、停止時に録音も停止するなど。
        // ここでは、再生と録画のトグルは独立していると仮定。
        if (isPlayingRef.current) {
            stopCombinedPlayback();
        } else {
            startCombinedPlayback(getCurrentBpm());
        }
    }, [stopCombinedPlayback, startCombinedPlayback, getCurrentBpm]);

    const togglePlaybackStyle = useCallback(() => {
        // (変更なし、ただし録音中のスタイル変更時の挙動は要検討)
        if (isPlayingRef.current) stopCombinedPlayback();
        // if (isActuallyRecordingRef.current) stopAudioProcessing(); // スタイル変更時に録音を停止するかどうか
        setPlaybackStyle(prevStyle => {
            const hasAccompaniment = isPlaybackOsmdReady && !!accompanimentXml;
            if (prevStyle === 'score') return 'metronome';
            if (prevStyle === 'metronome') return hasAccompaniment ? 'accompaniment' : 'score';
            if (prevStyle === 'accompaniment') return 'score';
            return 'score';
        });
    }, [isPlaybackOsmdReady, accompanimentXml, stopCombinedPlayback /*, stopAudioProcessing */]);

    const getPlaybackStyleButtonContent = useCallback((style: PlaybackStyle, accReady: boolean): { icon: JSX.Element; text: string } => {
        // (変更なし)
        if (style === 'score') return { icon: <MdQueueMusic size="1.2em" />, text: "楽譜通り" };
        if (style === 'metronome') return { icon: <TbMetronome size="1.2em" />, text: "メトロノーム" };
        if (style === 'accompaniment') return { icon: accReady ? <LuPiano size="1.2em" /> : <MdQueueMusic size="1.2em" />, text: accReady ? "伴奏" : "伴奏なし" };
        return { icon: <IoMusicalNotesOutline size="1.2em" />, text: "スタイル切替" };
    }, []);

    const buttonContent = getPlaybackStyleButtonContent(playbackStyle, isPlaybackOsmdReady && !!accompanimentXml);
    
    const handleBpmChangeWithStop = useCallback((doUp: boolean) => {
        // (変更なし、ただし録音中のBPM変更時の挙動は要検討)
        if (isPlayingRef.current) stopCombinedPlayback(); 
        // if (isActuallyRecordingRef.current) stopAudioProcessing();
        handlebpmChangeCallback(doUp);
    }, [handlebpmChangeCallback, stopCombinedPlayback /*, stopAudioProcessing */]);

    const handleDifficultyChangeWithStop = useCallback((newDiff: Difficulty) => {
        // (変更なし、ただし録音中の難易度変更時の挙動は要検討)
        if (isPlayingRef.current) stopCombinedPlayback(); 
        // if (isActuallyRecordingRef.current) stopAudioProcessing();
        onDifficultyChange(newDiff);
    }, [onDifficultyChange, stopCombinedPlayback /*, stopAudioProcessing */]);

    useEffect(() => {
        // (変更なし)
        if (isPlaying && displayStoppedRef.current && accompanimentStoppedRef.current) {
            if(isPlayingRef.current) setIsPlaying(false);
        }
    }, [isPlaying]);

    return (
        // (JSX部分は変更なし)
        <div>
            <div ref={playbackOsmdContainerRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}/>
            <button onClick={() => handleBpmChangeWithStop(false)} disabled={(isPlaying || isActuallyRecording) && getCurrentBpm() <= (10 - basebpm + basebpm)}>BPM ＜＜</button>
            <span style={{ display: 'inline-block', minWidth: '4em', textAlign: 'center', margin: '0 5px' }}>{getCurrentBpm()}bpm</span>
            <button onClick={() => handleBpmChangeWithStop(true)} disabled={isPlaying || isActuallyRecording}>BPM ＞＞</button>
            <button onClick={handlePlayPause} style={{ marginLeft: '10px' }}>{isPlaying ? "⏹️ 停止" : "▶️ 再生"}</button>
            <button style={{ marginLeft: '10px' }} onClick={() => { if(!isPlayingRef.current && !isActuallyRecordingRef.current && osmd.current?.cursor?.iterator) { osmd.current.cursor.next(); if(osmd.current.cursor.iterator.CurrentMeasure) onRequestScrollToMeasure(osmd.current.cursor.iterator.CurrentMeasure.MeasureNumber, true); }}} disabled={!osmd.current?.Sheet || isPlaying || isActuallyRecording}>次へ</button>
            <button onClick={() => { if(!isPlayingRef.current && !isActuallyRecordingRef.current && osmd.current?.cursor?.iterator) { osmd.current.cursor.previous(); if(osmd.current.cursor.iterator.CurrentMeasure) onRequestScrollToMeasure(osmd.current.cursor.iterator.CurrentMeasure.MeasureNumber, true); }}} disabled={!osmd.current?.Sheet || isPlaying || isActuallyRecording}>前へ</button>
            <button style={{ marginLeft: '10px' }} onClick={() => onProficiencyUpdate(getDummyProficiency())} disabled={isPlaying || isActuallyRecording}>習熟度(仮)</button>
            <button style={{ marginLeft: '10px' }} onClick={() => handleDifficultyChangeWithStop(Math.max(0, difficulty - 1) as Difficulty)} disabled={difficulty === 0 || isPlaying || isActuallyRecording}>難易度 ＜</button>
            <span style={{ display: 'inline-block', minWidth: '3em', textAlign: 'center', margin: '0 5px' }}>{difficulty === 0 ? "auto" : `Lv ${difficulty}`}</span>
            <button onClick={() => handleDifficultyChangeWithStop(Math.min(5, difficulty + 1) as Difficulty)} disabled={difficulty === 5 || isPlaying || isActuallyRecording}>難易度 ＞</button>
            <div style={{ marginTop: '10px' }}>
                <button onClick={() => setIsRecordingFeatureEnabled(!isRecordingFeatureEnabled)} style={{ marginRight: '10px' }} disabled={isActuallyRecording}>
                    録音機能: {isRecordingFeatureEnabled ? "有効" : "無効"}
                </button>
                <button 
                    onClick={handleToggleRecording} 
                    style={{ marginRight: '10px' }} 
                    disabled={isPlaying || !isRecordingFeatureEnabled || typeof MediaStreamTrackProcessor === 'undefined'} // WebCodecs未サポート時も無効化
                >
                    {isActuallyRecording ? "■ 録音停止" : "● 録音開始"}
                </button>
                <button 
                    onClick={togglePlaybackStyle} 
                    title="再生方法を切り替えます" 
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3em' }} 
                    disabled={isPlaying || isActuallyRecording}
                >
                    {buttonContent.icon} {buttonContent.text}
                </button>
            </div>
        </div>
    );
}