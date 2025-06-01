from pathlib import Path

import numpy

from extract_notes import load_audio, detect_pitch_pyin, detect_onsets, segment_notes


def calculate_proficiency(
    audio: numpy.ndarray,
    difficulty: int,
    correct_pitches: list[tuple[float, float]],
    current_proficiency: float,
    sampling_rate: float = 44100,
) -> float:
    detected_f0, f0_hop_length = detect_pitch_pyin(audio, sampling_rate)
    detected_onset_frames, _, _ = detect_onsets(audio, sampling_rate, hop_length=f0_hop_length)
    extracted_notes = segment_notes(audio, sampling_rate, detected_onset_frames, detected_f0, f0_hop_length)

    correct_count = 0
    for correct_pitch in correct_pitches:
        for i in range(len(extracted_notes)):
            # 正解周波数から前後音階の周波数の範囲内に入ってたらいいことにする
            if not correct_pitch[0] / 1.059463094 < extracted_notes[i].freq < correct_pitch[0] * 1.059463094:
                continue

            correct_count += 1
            break
        if i + 1 >= len(extracted_notes):
            break

        extracted_notes = extracted_notes[i + 1 :]

    accuracy = correct_count / len(correct_pitches)

    base_difference = (difficulty - current_proficiency) * 0.5

    if base_difference < 0:
        return base_difference * (1 - accuracy) + current_proficiency
    else:
        return max(0.1, base_difference) * accuracy + current_proficiency


if __name__ == "__main__":
    audio, sr = load_audio(Path(__file__).parent / "data" / "testsheet_pick.wav")

    # 完璧な演奏
    full_clear_proficiency = calculate_proficiency(
        audio, difficulty=5, correct_pitches=[(130.813, 0.2)], current_proficiency=3, sampling_rate=sr
    )
    assert full_clear_proficiency == 4

    full_clear_proficiency = calculate_proficiency(
        audio, difficulty=5, correct_pitches=[(130.813, 0.2)], current_proficiency=6, sampling_rate=sr
    )
    assert full_clear_proficiency == 6

    # 半分できてる演奏
    half_clear_proficiency = calculate_proficiency(
        audio, difficulty=5, correct_pitches=[(130.813, 0.2), (400, 0.2)], current_proficiency=3, sampling_rate=sr
    )
    assert half_clear_proficiency == 3.5

    half_clear_proficiency = calculate_proficiency(
        audio, difficulty=5, correct_pitches=[(130.813, 0.2), (400, 0.2)], current_proficiency=6, sampling_rate=sr
    )
    assert half_clear_proficiency == 5.75

    # 一つもできてない演奏
    dumb_proficiency = calculate_proficiency(
        audio, difficulty=5, correct_pitches=[(400, 0.2)], current_proficiency=3, sampling_rate=sr
    )
    assert dumb_proficiency == 3

    dumb_proficiency = calculate_proficiency(
        audio, difficulty=5, correct_pitches=[(400, 0.2)], current_proficiency=6, sampling_rate=sr
    )
    assert dumb_proficiency == 5.5
