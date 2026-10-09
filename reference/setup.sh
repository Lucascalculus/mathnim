#!/usr/bin/env bash
# Python tools: real Manim as the reference implementation for manim-web's
# regression tests, and edge-tts for pre-generated lesson narration.
# Creates reference/.venv. Needs Python 3.11+ and, on macOS,
# `brew install cairo pango pkg-config` if the wheels do not cover your platform.
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install "manim==0.21.0" networkx edge-tts
echo "Reference ready: $(pwd)/.venv/bin/python -c 'import manim; print(manim.__version__)'"
