#!/usr/bin/env bash
# Builds placard-ocr into tools/ocr/bin/. No Xcode project needed.
#
# The recognition pipeline is OCRCore.swift in the app's Vision module — one file
# compiled into both the CLI and the phone, so the corpus tool and the app cannot
# drift (D3). FaceCore.swift, beside it, is the phone's face pass (D49). main.swift
# is only the Mac driver around them.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p bin
swiftc -O \
  -framework Vision -framework ImageIO -framework CoreImage -framework CoreLocation \
  -o bin/placard-ocr \
  ../../apps/learner/modules/vision-ocr/ios/OCRCore.swift \
  ../../apps/learner/modules/vision-ocr/ios/FaceCore.swift \
  main.swift
echo "built: $(pwd)/bin/placard-ocr"
