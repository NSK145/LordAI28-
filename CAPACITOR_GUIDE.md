# LORD AI - Capacitor Android Guide

## Changes Made

The web app is packaged locally by Capacitor. Android API requests are sent to the existing LORD deployment; model selection and provider keys remain server-side.

## How to Build the APK

### 1. Set Your Backend URL

Before building, set the public HTTPS origin for the deployed LORD backend in your local `.env`:

```env
VITE_API_BASE_URL=https://your-lord-deployment.example
```

Native builds reject non-HTTPS backend URLs. Relative `/api/...` calls are routed to this origin as well. The URL is public configuration; never place provider keys in a `VITE_` variable.

### Local debug build

If you have Android Studio installed locally, you can build the APK yourself:

```bash
npm install --legacy-peer-deps
npm run build:android
```

Then open the `android` folder in Android Studio to run it on an emulator or device.

### Signed release build

Release APK/AAB builds use R8 and require a signing key supplied outside the repository. Set these environment variables in the build environment:

```env
LORD_ANDROID_KEYSTORE_FILE=/secure/path/lord-release.jks
LORD_ANDROID_KEYSTORE_PASSWORD=...
LORD_ANDROID_KEY_ALIAS=...
LORD_ANDROID_KEY_PASSWORD=...
```

Then run `npm run build:android:aab`. Do not commit the keystore or passwords. Google Play App Signing and store listing requirements still need to be completed in Play Console.

## Notes

- Android uses the system certificate store and blocks cleartext traffic; no permissive certificate override is configured.
- Supabase access/refresh sessions use an AES-GCM key held by Android Keystore. Existing WebView sessions migrate on first read; Android app backups are disabled so session data is not copied through device backup.
- Chat uploads continue through the existing chat backend endpoint. Camera images are resized/compressed by Capacitor before entering that flow.
- App shortcuts and local notification taps open internal routes using the `lordai://open/...` scheme.
- Remote push notifications require a Firebase project plus a backend registration/delivery path. Neither exists in this repository yet, so push delivery is not configured.
- Offline study data is an on-device read-only cache. Sending messages and syncing still require a connection.
