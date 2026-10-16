# LORD AI voice assistant

The authenticated `/voice` route provides tap-to-talk and an opt-in “Hey, LORD” wake phrase. The dashboard quick action and primary navigation open this route. The microphone is requested only after the user enables voice, and recognition is stopped when voice is muted, the route is left, or the tab becomes hidden.

## Speech recognition and privacy

The implementation uses the browser's `SpeechRecognition` or `webkitSpeechRecognition` API. It does not use an acoustic wake-word model, upload raw recordings to LORD's chat API, or listen outside this open, active page. Browser support and recognition reliability vary; browser implementations may use a browser-vendor speech service. When recognition is missing or interrupted, the page explains the limitation and retains the text command field as a fallback. Continuous wake listening stops after repeated browser interruptions and requires the user to retry.

Speech-to-text yields transcript text, which is sent to the existing authenticated `/api/chat` endpoint. Voice messages are saved to the existing `conversations` and `messages` tables under the signed-in user's account. Spoken responses use browser speech synthesis and follow the user's saved spoken-replies preference. Subtitles and spoken replies are independently controlled.

## Configuration and deployment

No new environment variables or provider keys are required. The feature uses the app's existing Supabase authentication, database policies, API configuration, and chat provider configuration.

For local development, run `npm install` and `npm run dev`, sign in, then open **Voice Assistant** from the dashboard or visit `/voice`. A production deployment uses the repository's existing Vercel project and environment configuration: run the checks below, then deploy through the existing Vercel workflow (or `vercel --prod` if that is the project's configured process). This change does not deploy automatically.

The voice assistant requires a secure context (HTTPS, or localhost for development), a signed-in user for chat persistence, and a browser exposing both microphone access and Web Speech recognition for voice input. Text commands remain available without speech recognition.
