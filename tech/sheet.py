from pathlib import Path

from bs4 import BeautifulSoup
from matplotlib import pyplot
from pydantic import BaseModel


STEP_STR2INT = {
    "A": 9,
    "B": 11,
    "C": 0,
    "D": 2,
    "E": 4,
    "F": 5,
    "G": 7,
}


class Note(BaseModel):
    time: float
    freq: float


def step2freq(step: int) -> float:
    return 27.5 * 2 ** (step // 12) * 1.059463094 ** (step % 12)


def load_sheet(xml: str) -> list[list[Note]]:
    soup = BeautifulSoup(xml, "lxml")

    measure_list = []
    cur_time = 0  # Current time
    duration = 0
    # parse
    for m in soup.find_all("measure"):
        measure_sounds = []
        for nb in m.find_all({"note"}):
            if nb.voice.string != "1":
                continue
            if not nb.chord:
                cur_time += duration

            if nb.duration:
                duration = int(nb.duration.string)

            if nb.pitch:
                if nb.pitch.alter:
                    alter = int(nb.pitch.alter.string)
                else:
                    alter = 0

                measure_sounds.append(
                    Note(
                        time=cur_time,
                        freq=step2freq((int(nb.pitch.octave.string)) - 1) * 12 + 3 + STEP_STR2INT[nb.pitch.step.string] + alter,
                    )
                )
        measure_list.append(measure_sounds)

    return measure_list


def main() -> None:
    xml_path = Path(__file__).parent / "data" / "testsheet_pick.xml"

    sheet = load_sheet(xml_path.read_text())

    for measure in sheet:
        print(measure)
        print(len(measure))
        break

    dots = [(note.time, note.freq) for measure in sheet for note in measure]

    pyplot.scatter([dot[0] for dot in dots], [dot[-1] for dot in dots])

    pyplot.yscale("log")
    pyplot.show()


if __name__ == "__main__":
    main()
