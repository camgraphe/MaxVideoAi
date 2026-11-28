"""Save a private admin replay from the CSV emitted by the SELECT-only export."""
import argparse
import csv
import json
import os
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("start_day", type=date.fromisoformat)
    parser.add_argument("end_day", type=date.fromisoformat, help="Exclusive Europe/Madrid date")
    parser.add_argument("output", type=Path, help="Private JSON file outside the public web root")
    args = parser.parse_args()
    if args.end_day - args.start_day != timedelta(days=30):
        parser.error("The export must contain 30 complete calendar days.")
    reader = csv.DictReader(sys.stdin)
    if reader.fieldnames != ["replay_group"]:
        parser.error("Expected the replay_group column from export-routing-replay-sql.ts.")
    groups = []
    madrid = ZoneInfo("Europe/Madrid")
    for row in reader:
        group = json.loads(row["replay_group"])
        hour = datetime.fromisoformat(group["bucketAt"].replace("Z", "+00:00"))
        if not args.start_day <= hour.astimezone(madrid).date() < args.end_day:
            parser.error("A profile falls outside the specified export window.")
        if type(group["jobs"]) is not int or group["jobs"] < 1:
            parser.error("Each profile must represent at least one request.")
        groups.append(group)
    archive = dict(version=1, startDay=args.start_day.isoformat(), endDay=args.end_day.isoformat(),
                   capturedAt=datetime.now(timezone.utc).isoformat(), groups=groups)
    # Keep the previous snapshot available until the full replacement is on disk.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", dir=args.output.parent, delete=False, encoding="utf-8") as out:
            temporary = Path(out.name)
            json.dump(archive, out, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temporary, args.output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
