#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d android ]; then npx cap add android; fi
mkdir -p android/app/src/main/java/ph/kalma/offline
cp native/android/OfflineLLMPlugin.kt native/android/MainActivity.java android/app/src/main/java/ph/kalma/offline/
python3 - <<'PY'
from pathlib import Path
root=Path('android/build.gradle')
s=root.read_text()
if 'org.jetbrains.kotlin:kotlin-gradle-plugin' not in s:
 s=s.replace('dependencies {','dependencies {\n        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25"',1)
root.write_text(s)
p=Path('android/app/build.gradle')
s=p.read_text()
if "apply plugin: 'org.jetbrains.kotlin.android'" not in s:
 s="apply plugin: 'org.jetbrains.kotlin.android'\n"+s
if 'dev.ffmpegkit-maintained:llama-android' not in s:
 s=s.replace('dependencies {','dependencies {\n    implementation "dev.ffmpegkit-maintained:llama-android:0.1.1"\n',1)
p.write_text(s)
PY
sed -i 's/minSdkVersion = 23/minSdkVersion = 24/g' android/variables.gradle
npm run android:sync
