import json
import sys
import numpy
# calculate_proficiency.py が同じディレクトリにあると仮定
from calculate_proficiency import calculate_proficiency

def main():
    try:
        input_data_str = sys.stdin.read()
        if not input_data_str:
            # 標準入力が空の場合のエラーハンドリング
            print(json.dumps({"error": "No input data received from stdin."}), file=sys.stderr)
            sys.exit(1)
        
        input_data = json.loads(input_data_str)

        audio_list = input_data.get("audio")
        if audio_list is None:
            raise ValueError("Missing 'audio' data in input JSON.")
        audio_np = numpy.array(audio_list, dtype=numpy.float64)

        difficulty = input_data.get("difficulty")
        if difficulty is None: # 0も有効な値なので is None でチェック
            raise ValueError("Missing 'difficulty' data in input JSON.")

        correct_pitches_raw = input_data.get("correct_pitches")
        if correct_pitches_raw is None:
            raise ValueError("Missing 'correct_pitches' data in input JSON.")
        correct_pitches = [tuple(item) for item in correct_pitches_raw if isinstance(item, list) and len(item) == 2]
        if len(correct_pitches) != len(correct_pitches_raw):
             raise ValueError("Invalid format for 'correct_pitches'. Expected list of [float, float].")

        current_proficiency = input_data.get("current_proficiency")
        if current_proficiency is None: # 0も有効な値なので is None でチェック
            raise ValueError("Missing 'current_proficiency' data in input JSON.")

        sampling_rate = input_data.get("sampling_rate", 44100.0)

        result_proficiency = calculate_proficiency(
            audio=audio_np,
            difficulty=difficulty,
            correct_pitches=correct_pitches,
            current_proficiency=current_proficiency,
            sampling_rate=sampling_rate
        )
        json.dump({"proficiency": result_proficiency}, sys.stdout)

    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"JSON decoding error: {str(e)}"}), file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(json.dumps({"error": f"Input validation error: {str(e)}"}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"An unexpected error occurred in Python script: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()