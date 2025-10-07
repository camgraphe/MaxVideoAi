#!/usr/bin/env python3
import os
import shlex
import subprocess
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / "frontend" / ".env.local"
TARGET_ENVS = ["preview"]
SKIP_KEYS = {
    "VERCEL_OIDC_TOKEN",
}

if not ENV_PATH.exists():
    raise SystemExit(f"Env file not found: {ENV_PATH}")

def parse_line(line: str):
    line = line.strip()
    if not line or line.startswith('#'):
        return None
    if '=' not in line:
        return None
    key, value = line.split('=', 1)
    key = key.strip()
    value = value.strip()
    if value.startswith('"') and value.endswith('"') and len(value) >= 2:
        value = value[1:-1]
    value = value.strip()
    return key, value

with ENV_PATH.open() as fh:
    entries = dict(filter(None, (parse_line(line) for line in fh)))

keys = [k for k in entries.keys() if k not in SKIP_KEYS and entries[k] != ""]
keys.sort()

if not keys:
    raise SystemExit("No env keys parsed from .env.local")

for key in keys:
    value = entries[key]
    if value is None:
        continue
    for target in TARGET_ENVS:
        subprocess.run([
            "vercel",
            "env",
            "rm",
            key,
            target,
            "--yes",
        ], check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=str(ENV_PATH.parent))
        proc = subprocess.run(
            ["vercel", "env", "add", key, target],
            input=(value + "\n").encode(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(ENV_PATH.parent),
        )
        if proc.returncode != 0:
            raise SystemExit(
                f"Failed to set {key} for {target}: {proc.stderr.decode().strip()}"
            )
