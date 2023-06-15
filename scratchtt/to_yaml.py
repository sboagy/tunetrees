import argparse
import json
from pathlib import Path

import yaml


def main():
    parser = argparse.ArgumentParser(
        prog="to_yaml", description="converts json to yaml", epilog="Go for it"
    )
    parser.add_argument("filename")
    args = parser.parse_args()
    assert args.filename
    print(args.filename)
    json_file_path = Path(args.filename)
    assert json_file_path.exists()

    with open(json_file_path, "r") as f:
        json_object = json.load(f)

    output_path = json_file_path.parent.joinpath(f"{json_file_path.stem}.html")
    with open(output_path, "w") as f_out:
        yaml.dump(json_object, f_out)


if __name__ == "__main__":
    main()
