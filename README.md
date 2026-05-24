# Sitwego Driver App

Android app for Sitwego Drivers. Built with React Native + Expo.

---

## Stack

- **React Native** 0.85 · Expo SDK 56 · TypeScript
- **TanStack Query** v5 — server state & caching
- **gRPC** over OkHttp — real-time communication
- **Firebase** — Auth, App Check, Messaging, Remote Config
- **React Navigation** v7 — routing

---

## Prerequisites

- **Node.js** ≥ 20
- **Yarn** 1.22 — `npm i -g yarn`
- **JDK** 17 (OpenJDK recommended)
- **Android SDK** with build-tools 35, NDK 29 (set `ANDROID_HOME`)
- **Expo CLI** — `npm i -g expo-cli` *(optional, `npx expo` also works)*

---

## Setup

### 1. Clone

```bash
git clone https://github.com/Sitwego/Driver-App.git
cd Driver-App
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Environment variables (JS)

```bash
cp .env.example .env
```

Fill in `.env`:

```env
EXPO_PUBLIC_API_BASE_URL_DEV=https://<your-ngrok-tunnel>/   # dev tunnel
EXPO_PUBLIC_API_BASE_URL=https://<your-production-api>/     # production
EXPO_PUBLIC_FILE_BASE_URL=                                  # file server (optional)
GOOGLE_MAPS_API_KEY=AIza...                                 # Google Cloud Console
```

> `EXPO_PUBLIC_*` vars are available at runtime. `GOOGLE_MAPS_API_KEY` is build-time only (written into `AndroidManifest.xml` during prebuild).

### 4. URL secrets (Android native)

Append to `android/local.properties` (already gitignored):

```properties
DEBUG_REST_API_BASE_URL=https://<your-ngrok-tunnel>/
DEBUG_GRPC_SERVER_URL=<ngrok-host-without-scheme>
DEBUG_LOCATION_UPDATE_ENDPOINT=update-location-coordinates

RELEASE_REST_API_BASE_URL=https://<your-production-api>/
RELEASE_GRPC_SERVER_URL=<your-grpc-host>
RELEASE_LOCATION_UPDATE_ENDPOINT=update-location-coordinates
```

### 5. Firebase

Place `google-services.json` in the project root (gitignored). Download it from the Firebase Console → Project settings → Your Android app.

For **App Check** on a debug build:
1. Run the app once and filter Logcat for `FirebaseAppCheck`.
2. Copy the debug token that appears.
3. Firebase Console → App Check → your app → Manage debug tokens → add the token.

### 6. Release signing (for release builds only)

Add to `android/local.properties`:

```properties
RELEASE_STORE_FILE=/path/to/your.keystore
RELEASE_STORE_PASSWORD=...
RELEASE_KEY_ALIAS=...
RELEASE_KEY_PASSWORD=...
```

---

## Running

| Command | Description |
|---|---|
| `yarn android` | Build and run debug on connected device / emulator |
| `yarn start` | Start Metro bundler (reset cache) |
| `yarn build` | Assemble release APK |
| `yarn release` | Build and run release on device |
| `yarn clean` | Clean Gradle build cache |

---

## Remote Config

Production URLs and feature flags are served via Firebase Remote Config. The app blocks rendering until the first fetch completes, then falls back to the `.env` defaults if Firebase is unreachable.

Values managed in Remote Config:

| Key | Description |
|---|---|
| `API_BASE_URL` | Primary REST API base URL |
| `FILE_BASE_URL` | File / media server URL |
| `GRPC_SERVER_URL` | gRPC server host |
| `LOCATION_UPDATE_ENDPOINT` | Location update path |

---

## Contributing

We welcome contributions, but we prioritize high-quality issues and pull requests. Following these guidelines helps ensure a timely review.

**Rules:**
- We may not respond to every issue or PR.
- We may close an issue or PR without detailed feedback.
- We may lock discussions if our attention is being overwhelmed.
- We don't provide support for general build environment issues.

**Guidelines:**
- Check for existing issues before filing a new one.
- Open an issue and allow time for discussion before submitting a PR.

**PRs we'll skip:**
- Pure cosmetic or naming changes.
- Refactoring the codebase (e.g. swapping TanStack Query for Redux, restructuring navigation).
- Adding entirely new features without prior discussion.

We serve drivers across a wide range of conditions and devices. Well-written PRs that solve real problems concisely are the most valuable contributions. If your idea is bigger in scope, feel free to fork — that's what it's for.

### Forking

You're welcome to fork this app. If you do, please:

- Change all branding in the repository and UI to clearly differentiate from Sitwego.
- Update any support links (feedback forms, email, terms of service) to point to your own systems.
- Replace any analytics or error-collection integrations so data doesn't flow to Sitwego's systems.

**AGPL-3.0 notice:** this project is licensed under the GNU Affero General Public License v3.0. If you run a modified version of this app as a network service (including a backend that drivers connect to), you are required to make the complete corresponding source code of your modified version publicly available. This applies even if you never distribute the app as a binary. See the [LICENSE](./LICENSE) for the full terms.

### Security disclosures

If you discover a security vulnerability, please email **sityf237@gmail.com**. Do not open a public issue. We'll respond promptly.

---

## License

[GNU Affero General Public License v3.0](./LICENSE)
