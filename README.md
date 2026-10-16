# KALMA — Offline Mental Wellness Companion

Ionic React + Capacitor Android app for offline personal wellness.

## Features
- Mood check-ins, local journal, calming exercise
- Local conversational interface and chat history
- Android system picker to import a downloaded GGUF model
- Local model generation bridge for Android (experimental)
- Delete local history and imported model

## Development
Requires Node.js 22, Java 21, Android SDK, Python 3.

```bash
npm install
npm run dev
bash scripts/setup-android.sh
cd android
./gradlew assembleDebug
```

GitHub Actions also attempts a debug APK build after a push to main. Check its **Actions** tab and download the **kalma-debug-apk** artifact only after the workflow is green.

## Status and important limitations
The native inference bridge uses an **unverified** third-party llama Android library dependency (dev.ffmpegkit-maintained:llama-android:0.1.1). Its coordinates and Kotlin API may not resolve; the workflow may fail. No APK or actual model-inference test has yet succeeded. Do not treat this repository as a verified installable chatbot release.

KALMA is **not** a licensed psychologist, therapist, diagnostic service, or crisis-response service. Tiny LLMs can produce unsafe or inaccurate responses. The keyword-based urgent-message fallback is insufficient for a deployed mental-health product. Professional safety review, a robust offline safety strategy, accessible human-support pathways, and testing on physical devices are required before public release. Chat history and journal use browser localStorage, which is not encrypted storage.