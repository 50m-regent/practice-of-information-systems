import { useEffect, useRef } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Difficulty } from '../types/types';

interface OSMDPlayerProps {
  osmd: React.RefObject<OpenSheetMusicDisplay>;
  difficulty?: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
}

export function OSMDPlayer({ osmd, difficulty, onDifficultyChange }: OSMDPlayerProps) {
    const stoppedRef = useRef(true);
    const timerIdRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    
    const base_bpm = 120;
    const current_bpm = useRef<number>(base_bpm);
    const musicClipRef = useRef<[number, number][]>([]);
    
    const getNoteDurationMs = (duration: number, bpm: number) => {
        const beatMs = (60 / bpm) * 1000;
        return duration * beatMs * 4;
    };
    
    const midiNoteNumberToFrequency = (midiNoteNumber: number): number => {
        return 440 * Math.pow(2, (midiNoteNumber - 69) / 12);
    };

    const playBeep = (frequency: number, durationMs: number) => {
        const audioCtx = audioContextRef.current;
        if (!audioCtx) return;
        const oscillator = audioCtx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        oscillator.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + durationMs / 1000);
    };

    const playOSMDByCursor = (bpm: number) => {
        const currentOSMD = osmd.current;
        if (!currentOSMD) return;

        if (audioContextRef.current) {
            audioContextRef.current.close();
        }

        audioContextRef.current = new AudioContext();
        stoppedRef.current = false;

        const cursor = currentOSMD.cursor;
        // cursor.reset();
        // cursor.show();
        musicClipRef.current = []; // 音楽クリップを初期化
        const step = () => {
            if (stoppedRef.current || !audioContextRef.current) return;

            if (cursor.iterator.endReached) {
                cursor.reset();
                console.log((musicClipRef.current));
                const jsondata=JSON.stringify(musicClipRef.current);
                console.log(jsondata);
                return;
            }

            const voiceEntries = cursor.iterator.CurrentVoiceEntries;
            if (voiceEntries.length === 0) {
                timerIdRef.current = window.setTimeout(() => {
                    cursor.next();
                    step();
                }, 100);
                return;
            }

            const noteDurations = voiceEntries.flatMap(entry =>
                entry.Notes.map(note => note.length.realValue)
            );
            const duration = Math.max(...noteDurations);
            const durationMs = getNoteDurationMs(duration, bpm);

            const entry = voiceEntries[0]// 最初のエントリを取得
                entry.Notes.forEach(note => {
                    if (note.pitch) {
                        const freq = midiNoteNumberToFrequency(note.pitch.halfTone);
                        playBeep(freq, durationMs);
                        musicClipRef.current.push([freq, durationMs]);
                    }else{
                        const freq = 0; // デフォルトの周波数（A4）
                        musicClipRef.current.push([freq, durationMs]);
                        
                    }
                });
            // musicClipRef.current.push([freq, durationMs]);

            timerIdRef.current = window.setTimeout(() => {
                cursor.next();
                step();
            }, durationMs);
        };

        step();
    };

    const stopPlayback = () => {
        stoppedRef.current = true;
        if (timerIdRef.current !== null) {
            clearTimeout(timerIdRef.current);
            timerIdRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
    };

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            stopPlayback();
        };
    }, []); // Empty dependency array ensures this runs only on mount and unmount

    return (
        <div>
            <button
                onClick={() => {
                    if (difficulty !== undefined) {
                        onDifficultyChange(Math.max(0, difficulty - 1));
                    }
                }}
                disabled={difficulty === undefined}
            >＜ </button>
            <span style={{ display: 'inline-block', minWidth: '3em', textAlign: 'center' }}>
                {difficulty === undefined ? "-" : difficulty === 0 ? "auto" : ` ${difficulty} `}
            </span>
            <button
                onClick={() => {
                    if (difficulty !== undefined) {
                        onDifficultyChange(Math.min(5, difficulty + 1));
                    }
                }}
                disabled={difficulty === undefined}>＞ </button>
            <button onClick={() => {playOSMDByCursor(current_bpm.current)}}>
                ▶️ 再生
            </button>
            <button onClick={() => {(stoppedRef.current) ? playOSMDByCursor(current_bpm.current) : stopPlayback}}>
                {(stoppedRef.current) ? "▶️ 再生" : "⏹️ 停止"}
            </button>
            <button onClick={stopPlayback}>⏹️ 停止</button>
        </div>
    );
}