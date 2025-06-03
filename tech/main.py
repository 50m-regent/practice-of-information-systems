import numpy
from fastapi import FastAPI
from pydantic import BaseModel

from calculate_proficiency import calculate_proficiency


class ProficiencyRequest(BaseModel):
    audio: list[float]
    difficulty: int
    current_proficiency: float
    correct_pitches: list[tuple[float, float]]
    sampling_rate: float = 44100


app = FastAPI()


@app.post("/calculate_proficiency")
def calculate_proficiency_api(request: ProficiencyRequest):
    audio_data = numpy.array(request.audio)

    return {
        "proficiency": calculate_proficiency(
            audio_data, request.difficulty, request.correct_pitches, request.current_proficiency, request.sampling_rate
        )
    }
