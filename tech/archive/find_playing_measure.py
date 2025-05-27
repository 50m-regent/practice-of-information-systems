from pathlib import Path

import numpy
from matplotlib import pyplot
from scipy.io import wavfile
from scipy.signal import find_peaks

from tech.sheet import Note, load_sheet


def find_peak_freqs(audio: numpy.ndarray, sampling_rate: int) -> dict[float, float]:
    if audio.ndim > 1:
        audio = audio[:, 0]

    fft_result = numpy.fft.fft(audio)

    freqs = numpy.fft.fftfreq(len(audio)) * sampling_rate
    magnitude = numpy.abs(fft_result)[: len(audio) // 2]

    peaks, heights = find_peaks(magnitude, height=numpy.max(magnitude) * 0.1, distance=5)
    heights = heights["peak_heights"]
    peak_freqs = freqs[peaks]

    print(peaks)

    pyplot.plot(freqs[: len(audio) // 2][:1000], magnitude[:1000])
    pyplot.show()

    return dict(zip(peak_freqs.tolist(), heights.tolist()))


def find_measure(audio: numpy.ndarray, sampling_rate: int, sheet: list[list[Note]]) -> int:
    peak_freqs = sorted(list(find_peak_freqs(audio, sampling_rate).items()), key=lambda x: -x[-1])

    print(peak_freqs)
    for measure in sheet:
        measure_freqs = {note.freq for note in measure}
        print(measure_freqs)


def main() -> None:
    xml_path = Path(__file__).parent / "data" / "testsheet_pick.xml"

    sheet = load_sheet(xml_path.read_text())

    for i in range(1, 6):
        sampling_rate, audio = wavfile.read(Path(__file__).parent / "data" / f"{i}.wav")
        measure = find_measure(audio, sampling_rate, sheet)

        print(measure)


if __name__ == "__main__":
    main()
