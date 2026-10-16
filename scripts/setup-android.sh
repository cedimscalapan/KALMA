#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d android ]; then npx cap add android; fi
mkdir -p android/app/src/main/java/ph/kalma/offline
cp native/android/OfflineLLMPlugin.kt native/android/MainActivity.java android/app/src/main/java/ph/kalma/offline/
python3 - <<'PY'
from pathlib import Path
p=Path('android/app/build.gradle')
s=p.read_text()
needle='dependencies {'
assert needle in s
if 'dev.ffmpegkit-maintained:llama-android' not in s:
 s=s.replace(needle,needle+'\n    implementation "dev.ffmpegkit-maintained:llama-android:0.1.1"\n')
p.write_text(s)
PY
npm run android:sync
