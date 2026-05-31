# Location Permission System

Production-grade location-permission management for the Mobility Captain
(ride-hailing) app. Built on `expo-location` + `expo-intent-launcher`.

## Architecture

```
src/lib/location/
  types.ts                       Normalised types (PermissionState, snapshot, result)
  errors.ts                      Typed error + centralised user-facing copy
  LocationPermissionService.ts   Framework-agnostic singleton (all OS logic)
src/hooks/
  useLocationPermission.ts       React layer: reactive snapshot + AppState wiring
src/components/
  PermissionsDisclosureModal.tsx Two-step rationale UI (foreground → background)
  LocationPermissionGate.tsx     Wires hook + modal + recovery flows
```

Separation of concerns:

- **Service** — no React. All OS calls, sequencing, GPS detection, settings
  deep-links, persisted one-shot flags. Easy to unit-test by mocking
  `expo-location`. Expected outcomes are **returned** as `LocationPermissionResult`;
  only unexpected failures **throw** `LocationPermissionError`.
- **Hook** — owns the reactive `status` snapshot, re-reads it on `AppState`
  resume (so changes made in Settings are picked up), and guards against
  re-entrancy / double-taps. No manual memoisation (React Compiler is enabled).
- **Gate** — the only stateful policy layer. Decides *when* to show the modal,
  enforces "foreground before background", and routes blocked permissions to
  Settings.

## Permission states

Expo's `(status, canAskAgain)` pair is collapsed into one exhaustive union:

| State          | Meaning                                            | Recovery        |
| -------------- | -------------------------------------------------- | --------------- |
| `granted`      | Usable.                                             | —               |
| `denied`       | Refused, OS will still prompt next time.           | Re-request      |
| `blocked`      | Permanently refused ("Don't ask again").           | Open Settings   |
| `undetermined` | Never requested.                                   | Request         |

## Flow

1. Driver logs in → `LocationPermissionGate` mounts (`App.tsx`, gated on
   `isLoggedIn`).
2. Foreground not granted → full-screen disclosure (step `permissions`).
3. Confirm → `requestForeground()`:
   - granted → ensure GPS on (Android shows native dialog) → advance to step `background-location`.
   - denied → rationale alert, stays on step.
   - blocked → "Open Settings" alert.
4. Background step → `requestBackground()`:
   - granted → done.
   - Android 11+ returns without a dialog → "Open Settings (Allow all the time)" alert.
5. Disclosure shown flag is persisted (MMKV) → background is asked **at most
   once automatically**. Reset on logout.

## Platform notes

### Android

- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` / `ACCESS_BACKGROUND_LOCATION`
  are declared in `app.config.js`.
- **Android 10 (API 29)** introduced background location as a separate grant.
- **Android 11+ (API 30)** — background ("Allow all the time") **cannot** be
  granted from an in-app dialog; it only works from system Settings. The service
  surfaces this as `code: "blocked"` so the gate shows an Open-Settings CTA.
- **Android 12+ (API 31)** — users can grant *approximate* (coarse) location
  only. `snapshot.preciseLocation` reports this (`android.accuracy === 'coarse'`).
- **Android 13+ (API 33)** — runtime notification permission is separate
  (handled elsewhere); location behaviour is unchanged from 12.
- GPS master toggle: `enableNetworkProviderAsync()` shows the native
  "Turn on location?" dialog; `LOCATION_SOURCE_SETTINGS` deep-link as fallback.

### iOS

- `NSLocationWhenInUseUsageDescription` and
  `NSLocationAlwaysAndWhenInUseUsageDescription` are injected via the
  `expo-location` plugin config (`app.config.js`). `UIBackgroundModes: location`
  is set for continued background updates.
- iOS only allows the "upgrade to Always" prompt **once**; afterwards the user
  must change it in Settings.
- iOS 14+ "Precise: Off" → `snapshot.preciseLocation === false`
  (`ios.accuracy === 'reduced'`).
- There is **no** programmatic way to toggle location services on iOS — the
  service reports the state and the gate guides the user to Settings.

## Usage

### Via the gate (default — already wired in `App.tsx`)

Nothing to do; the disclosure runs automatically after login.

### Programmatic (e.g. a "Location" row in settings, or before going online)

```ts
import { useLocationPermission } from "~/hooks/useLocationPermission";

function GoOnlineButton() {
  const { isReady, requestForeground, openAppSettings } = useLocationPermission();

  const onGoOnline = async () => {
    if (isReady) return startShift();
    const res = await requestForeground();
    if (res.granted) return startShift();
    if (res.code === "blocked") openAppSettings();
  };
}
```

### Service directly (outside React, e.g. a saga / native bridge glue)

```ts
import { LocationPermissionService } from "~/lib/location/LocationPermissionService";

if (await LocationPermissionService.isForegroundReady()) {
  startBackgroundService(profileId);
}
```

## Error handling

- `LocationPermissionResult` (returned): the normal path. Branch on `granted`
  and `code`.
- `LocationPermissionError` (thrown): only for unexpected API failures, with a
  `code` and optional `cause`. The hook's `refresh()` swallows these and
  degrades gracefully (keeps the last known snapshot).
- All request methods are wrapped in a 12s timeout to survive OEM ROMs whose
  permission callbacks occasionally hang.

## Testing recommendations

- **Unit** — mock `expo-location` / `expo-intent-launcher`; assert
  `toPermissionState` mapping, the foreground-before-background guard, and the
  Android-11 "blocked" surfacing. The service has no React deps.
- **Component** — render the gate with a mocked hook; assert step transitions
  and that background is never requested before foreground.
- **Manual / device matrix** — Android 10, 11, 12 (coarse), 13; iOS 14+
  (Precise off), iOS "While Using" → upgrade to "Always"; GPS off; airplane
  mode; deny-then-Settings recovery; backgrounding during the OS prompt.
- Argent MCP can drive the emulator through the flow (see project rules).
```
