from pathlib import Path

import librosa
import numpy
from pydantic import BaseModel


class Note(BaseModel):
    start_time: float
    duration: float
    freq: float


def load_audio(file_path: Path, target_sr=22050) -> tuple[numpy.ndarray, float]:
    y, sr = librosa.load(file_path, sr=target_sr, mono=True)
    return y, sr


def detect_pitch_pyin(
    y: numpy.ndarray,
    sr: float,
    fmin=librosa.note_to_hz("C2"),
    fmax=librosa.note_to_hz("C7"),
    frame_length: int = 2048,
    hop_length: int = 512,
) -> tuple[numpy.ndarray, int]:
    """librosa.pyinを使用してF0系列を推定する"""
    f0, voiced_flag, _ = librosa.pyin(y, fmin=fmin, fmax=fmax, sr=sr, frame_length=frame_length, hop_length=hop_length)
    # voiced_flagがFalseのフレーム（無音または非周期的な音）のf0をnumpy.nanで埋める
    f0[~voiced_flag] = numpy.nan
    return f0, hop_length


def detect_onsets(
    y: numpy.ndarray, sr: float, hop_length: int = 512, backtrack: bool = False
) -> tuple[numpy.ndarray, numpy.ndarray, int]:
    """librosa.onset.onset_detectを使用してオンセットフレームを検出する"""
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop_length, backtrack=backtrack)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop_length)
    return onset_frames, onset_times, hop_length


def segment_notes(
    y: numpy.ndarray, sr: float, onset_frames: numpy.ndarray, f0_contour: numpy.ndarray, pitch_hop_length: int
) -> list[Note]:
    """
    オンセットフレームとF0コンターからノート情報を抽出する。
    単純化のため、ノートのオフセットは次のオンセットの開始時刻とする。
    """
    notes = []
    if len(onset_frames) == 0:
        return notes

    onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=pitch_hop_length)

    for i in range(len(onset_frames)):
        start_time = onset_times[i]
        pitch_frame_idx = librosa.time_to_frames(start_time, sr=sr, hop_length=pitch_hop_length)

        current_pitch_hz = numpy.nan
        if pitch_frame_idx < len(f0_contour):
            stable_pitch_idx_start = min(pitch_frame_idx + 1, len(f0_contour) - 1)
            stable_pitch_idx_end = min(pitch_frame_idx + 4, len(f0_contour))

            pitch_candidates = f0_contour[stable_pitch_idx_start:stable_pitch_idx_end]
            pitch_candidates = pitch_candidates[~numpy.isnan(pitch_candidates)]
            if len(pitch_candidates) > 0:
                current_pitch_hz = numpy.median(pitch_candidates)
            elif not numpy.isnan(f0_contour[pitch_frame_idx]):
                current_pitch_hz = f0_contour[pitch_frame_idx]

        if numpy.isnan(current_pitch_hz):
            continue

        if i < len(onset_frames) - 1:
            end_time = onset_times[i + 1]
        else:
            end_time = librosa.get_duration(y=y, sr=sr)

        duration = end_time - start_time

        if duration <= 0:
            continue

        notes.append(Note(start_time=start_time, duration=duration, freq=current_pitch_hz))

    return notes


def main() -> None:
    audio_file_path = Path(__file__).parent / "data/testsheet_pick_noised.wav"
    y_audio, sample_rate = load_audio(audio_file_path)

    detected_f0, f0_hop_length = detect_pitch_pyin(y_audio, sample_rate)

    detected_onset_frames, _, _ = detect_onsets(y_audio, sample_rate, hop_length=f0_hop_length)

    extracted_notes = segment_notes(y_audio, sample_rate, detected_onset_frames, detected_f0, f0_hop_length)

    for note in extracted_notes:
        print(
            f"Time: {note.start_time:.2f}-{note.duration + note.start_time:.2f}s "
            f"Duration: {note.duration:.2f}s "
            f"Pitch: {librosa.hz_to_note(note.freq)} ({note.freq:.2f} Hz)"
        )


if __name__ == "__main__":
    main()
