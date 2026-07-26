# Tracking pipeline — implementation notes

Running log of decisions and deviations per step of REALTIMETRACKING.md
(the spec now lives in this folder so it survives across sessions).
Newest step last.

## Step 1 — Route geometry (`routeGeometry.ts` + Nitro `MapsGeometry`)

### What was built

- `src/tracking/types.ts` — shared plain-data types (`LocationFix`, `FixSource`,
  `RouteTable`, `PathProjection`, …). No react-native imports anywhere in the
  pipeline core, so everything runs under Jest in plain Node.
- `src/tracking/polyline.ts` — encoded-polyline codec (precision 5). `decode`
  mirrors `PolyUtil.decode`; `encode` exists for fixtures/replay harness.
- `src/tracking/geo.ts` — haversine distance / heading / heading-wrap helpers
  (same Earth radius constant as Google's libs, worklet-safe).
- `src/tracking/routeGeometry.ts` — `buildRouteTable`, `prepareRouteTS`,
  zero-alloc `pointAtInto` (binary search + linear interpolation, 60 Hz path),
  `windowIndexRange`/`fullIndexRange` clamping helpers, `projectOnPathTS`.
- Nitro module `MapsGeometry` (Android, Kotlin):
  - spec `src/tracking/specs/MapsGeometry.nitro.ts`; codegen committed under
    `nitrogen/generated/` (regenerate with `yarn nitrogen`).
  - impl `android/app/src/main/java/com/margelo/nitro/mapsgeometry/HybridMapsGeometry.kt`
    wrapping `PolyUtil.decode`, `SphericalUtil.computeDistanceBetween/…Heading`,
    `PolyUtil.distanceToLine`. The instance retains the decoded route, so
    `projectOnPath` crosses JNI with 4 scalars.
  - `src/tracking/mapsGeometry.ts` — provider that prefers the native module
    and falls back to the pure-TS implementation.

### Decisions & deviations from the spec

1. **TS "mirror" implementations exist next to the native module.** The spec
   forbids hand-rolled spherical math where android-maps-utils provides it;
   the runtime authority IS the Nitro module. But the acceptance criteria
   require Jest tests of `pointAt(projectOnPath(p).d)` round-trips, and Jest
   can't load JNI — so `projectOnPathTS`/`prepareRouteTS` are the numerically
   interchangeable reference used by tests, iOS (for now), and as a safety
   fallback if the .so fails to load. Both implementations use the same
   dedupe/window/clamp semantics; the projection fraction uses the same
   planar approximation `PolyUtil.distanceToLine` uses internally.
2. **iOS is an explicit Android-first stub** (allowed by Step 1 acceptance).
   The `.nitro.ts` spec declares `{ android: 'kotlin' }` only; on iOS
   `getGeometryProvider()` returns the TS fallback. When iOS lands: add
   `ios: 'swift'` to the spec, implement with `GMSGeometryUtils`, re-run
   nitrogen.
3. **In-app Nitro module rather than a separate package.** The module lives in
   the app (spec in `src/tracking/specs`, Kotlin in `android/app`, JNI glue in
   `nitro-android/`). Build integration detail that cost the most care: the
   app now owns `externalNativeBuild.cmake.path` (`android/CMakeLists.txt`),
   and because the RN gradle plugin only installs its default New-Architecture
   CMake when the app has none, our CMakeLists **replicates RN's
   default-app-setup** (`project(appmodules)` + `ReactNative-application.cmake`)
   before adding `libMapsGeometry.so` via `add_subdirectory(../nitro-android)`
   — the subdirectory keeps nitrogen's global `add_definitions` out of the
   appmodules target. Do not put stray `.cpp` files in `android/` — RN's cmake
   globs them as an OnLoad.cpp override.
4. **`bearings[i]` is the segment tangent** (heading of vertex i → i+1),
   `bearings[n-1]` repeats the last segment. Smoothing of heading through
   vertices is the motion model's job (Step 4 slerp), not the table's.
5. **`pointAt` clamps `d` to `[0, totalLength]`** — arrival pins to the
   destination (edge-case checklist) and negative `d` pins to the start.
6. **Perf acceptance measured on Node/V8, not Hermes.** Jest runs on Node;
   10k `pointAtInto` calls on a 1,000-vertex route measured well under the
   20 ms budget (see evidence). An on-device Hermes measurement will be added
   to the Step 6 dev screen; the function is branch+array math with no
   allocation, so no Hermes-specific risk is expected.
7. **Longitude interpolation is linear** — fine for Nairobi and any route not
   crossing the antimeridian; documented as a known non-feature.
8. **Jest setup is scoped to `src/tracking`** with an inline babel config
   (`configFile: false`) so `babel-preset-expo`/reanimated plugin are not
   loaded for unit tests. Note: the installed `@babel/preset-typescript`
   fails to strip `new Array<number>(n)`-style NewExpression generics —
   avoid that syntax in this folder (use `const x: number[] = new Array(n)`).

### Acceptance evidence

- `yarn test`: 2 suites, 22 tests green — includes:
  - round-trip `pointAt(projectOnPath(p).d)` ≤ 1 m for on-route points sampled
    every 10 m, and for a 10 m-perpendicular-offset point;
  - U-shaped-route fixture: ambiguous mid-point resolves to the correct leg
    for out-leg and return-leg windows; out-leg window never reaches the
    return leg;
  - window clamping on a < 200 m route (clamps, never wraps);
  - `pointAtInto` returns the caller's object (zero alloc) and 10,000 calls
    complete in < 20 ms (Node; warm-up loop before timing).
- `npx tsc --noEmit`: no errors in `src/tracking/**` (9 pre-existing errors
  elsewhere in the app, untouched).
- Android: `gradlew :app:externalNativeBuildDebug :app:compileDebugKotlin`
  → BUILD SUCCESSFUL (14m 44s, 1027 tasks); produced both
  `libMapsGeometry.so` and `libappmodules.so` (arm64-v8a, armeabi-v7a) in
  `app/build/intermediates/cxx/Debug/**` — confirming the custom CMakeLists
  preserved RN's New-Architecture appmodules build alongside the Nitro lib.

## Step 2 — Ingest gate (`ingestGate.ts`)

### What was built

- `src/tracking/ingestGate.ts` — stateful `IngestGate` class, pure TS,
  deterministic (time comes only from the fixes). Drop-never-repair rules,
  in evaluation order: non-finite fields (`invalid`) → `seq` not strictly
  increasing (`duplicate_seq`, covers both duplicates and late out-of-order
  delivery) → `acc > 50 m` (`poor_accuracy`) → measurement clock jumped back
  > 2 s (`ts_regression`) → implied speed vs last accepted fix > 42 m/s
  (`teleport`). Accepted fixes are enriched with `smoothedSpd` (EMA, α = 0.4,
  falling back to implied speed when device `spd` is NaN/negative) and
  `heading` (`null` when `smoothedSpd < 1.5 m/s` or `brg` non-finite).
- `src/tracking/testing/replayFixSource.ts` — mock `FixSource` replaying a
  trace with original relative timing (wall-clock compressible via `speed`,
  loopable with an `onLoop` reset hook). Fixes keep their ORIGINAL `ts`
  values so time compression never alters the physics encoded in the data.
- `src/tracking/testing/corruptTrace.ts` — injects labeled corruptions
  (duplicate, out-of-order, teleport, backward-ts, poor-accuracy) into a
  clean trace; reused by the Step 6 harness toggles later.
- `src/tracking/testing/traceGenerator.js` + `generateTraceFixture.js` +
  committed fixture `testing/fixtures/nairobi-sim-trace.json` (107 fixes,
  ~262 s along the U-route: irregular 1–5 s cadence, one 12 s gap, a 20 s
  traffic stop, accuracy 4–35 m with matching gaussian position noise,
  15% `spd = 0` chip quirk, bearing garbage below 1.5 m/s, seq skips).
- `src/tracking/demo/TrackingDemo.tsx` — dev-only demo rendered inside
  `RnMapView` on `MapScreen` (`__DEV__`-gated): fixture route polyline,
  accepted (blue) / rejected (red) fix dots, a deliberately NAIVE per-fix
  marker (the baseline Steps 3–5 will visibly beat), and a status chip
  showing geometry provider (native Nitro vs TS fallback), accept/reject
  counts and the gate's derived signals. Camera pans to the route on mount.

### Decisions & deviations

1. **The "real recorded trace" fixture is synthetic.** No device recording
   was available in this session, so the committed fixture is generated by a
   deterministic, committed generator with a realistic urban noise model
   (see above). Regenerate with
   `node src/tracking/testing/generateTraceFixture.js`. TODO for QA: record
   an actual drive (same JSON shape) and drop it in as
   `nairobi-real-trace.json`; the acceptance test then runs over both.
2. **A rejected fix still consumes its `seq`** — a retransmit of a fix we
   dropped is a duplicate regardless of why the first copy was dropped.
3. **Implied-speed Δt is floored at 250 ms** so two fixes with (near-)equal
   timestamps can't launder a large jump through a division by ~zero.
4. **Small ts regressions (≤ 2 s) are tolerated**, and the implied-speed
   check handles them via the Δt floor; only regressions > 2 s are dropped.
5. **`heading` gates on the smoothed speed**, not the instantaneous device
   speed — one noisy `spd` sample shouldn't flip bearing validity.
6. **Demo ships in the dev bundle only** (`__DEV__ &&` in MapScreen), but its
   module (and the ~13 KB fixture JSON) is statically imported, so it sits in
   the production bundle unused. Acceptable for now; the Step 7 feature-flag
   work moves it behind a lazy dev screen.

### Acceptance evidence

- `yarn test`: 3 suites, 38 tests green. Step 2-specific:
  - table-driven cases covering every rule (duplicates, out-of-order seq,
    seq consumption by rejected fixes, acc boundary at exactly 50 m,
    non-finite fields, teleport at 100 m/s vs plausible 30 m/s, zero-Δt
    jump, ts regression boundary);
  - EMA smoothing, NaN-speed fallback to implied speed, bearing discard
    below 1.5 m/s, `reset()`;
  - committed realistic trace: rejects < 10% of fixes;
  - corrupted trace: rejects exactly the injected entries — and every fix
    the clean run accepted is still accepted with corruption interleaved
    (corrupt fixes don't poison gate state);
  - replay source: ordering, 10× time compression, loop hook, unsubscribe.
- `npx tsc --noEmit`: still only the 9 pre-existing app errors; nothing in
  `src/tracking/**`, `TrackingDemo.tsx` or `MapScreen.tsx`.

## Step 3 — Snap-to-polyline (`snap.ts`)

### What was built

- `src/tracking/snap.ts` — stateful `Snapper` class on top of the geometry
  provider (`projectOnPath` = MapsGeometry Nitro at runtime, TS mirror under
  Jest). Windowed search (last `d` − 100 m … + 500 m; full-route scan for the
  very first fix), monotonic non-decreasing `d` while snapped, and the
  off-route state machine: perpendicular > 30 m (45 m for `rideType: 'boda'`)
  for 5 consecutive fixes → `off_route`; while off-route the raw fix is
  passed through, `d` stays frozen, and the re-acquire search widens; 3
  consecutive fixes within 20 m snap back.
- `SnapResult` carries everything downstream stages need: `status`, `d`,
  render position (on-route point while snapped, raw fix while off-route),
  `bearing` (route tangent while snapped, `null` off-route — the polyline is
  the only bearing authority while snapped, and there is none off it),
  `perpendicularM` and `segmentIndex` for the dev overlay.

### Decisions & deviations

1. **Input is `Pick<LocationFix, 'lat' | 'lng'>`** (`SnapInput`) — the
   snapper reads nothing else, so plain fixes, `AcceptedFix`, and test
   points all feed it without adapters.
2. **During far-streak buildup (fixes 1–4) the output stays snapped** with
   the monotonic clamp active — the marker holds the route until off-route
   is *confirmed*, matching "zero perceptible teleports".
3. **Re-acquire resets the monotonic baseline.** The spec's "d never
   decreases" is honored within every snapped stretch; a detour may rejoin
   the route behind the frozen `d`, and pretending otherwise would pin the
   marker to a place the vehicle never returned to. The single discontinuity
   at re-acquire is the motion model's capped fast-forward to smooth
   (Step 4), same as the off-route→raw transition itself.
4. **The re-acquire window widens by raw distance traveled off-route**
   (accumulated haversine between consecutive off-route fixes, added to both
   window arms) — the vehicle cannot have advanced along the route farther
   than it physically moved. Deterministic (no wall-clock), and covered by a
   test that rejoins ~600 m past a deliberately tiny 100 m ahead-window.
5. **The very first fix always acquires as `snapped`** (full-route search)
   even if far from the route; a far first fix starts the off-route streak
   at 1, so a genuinely off-route start is confirmed 4 fixes later.
6. **`rideType` is a plain string** (`'boda'` → 45 m, anything else → 30 m);
   an explicit `offRouteThresholdM` option overrides either.

### Acceptance evidence

- `yarn test`: 4 suites, 51 tests green. Step 3-specific:
  - committed trace replayed through `IngestGate` → `Snapper`: `d` never
    decreases, status never leaves `snapped`, > 80 accepted fixes drive `d`
    past 90% of the route;
  - U-turn fixture: the ambiguous mid-point resolves to the out-leg while
    outbound and to the return-leg after driving through the hairpin; `d`
    is monotonic across the full out-hairpin-return drive;
  - synthetic detour: `off_route` fires on exactly the 5th consecutive far
    fix, raw positions pass through with `d` frozen and `bearing: null`,
    re-acquire fires on the 3rd consecutive ≤ 20 m fix, and a far blip
    mid-sequence resets the near-streak;
  - boda: a 38 m offset never leaves `snapped` for `rideType: 'boda'` while
    the default (car) goes off-route on the same input;
  - short-route window clamping, backward-projection clamp (position pins
    to the current `d`), `reset()` back to full-route acquisition.
- `npx tsc --noEmit`: still only the 9 pre-existing app errors; nothing in
  `src/tracking/**`.

## Step 4 — Motion model (`motionModel.ts`) + demo pipeline wiring

### What was built

- `src/tracking/motionModel.ts` — the per-frame heart of the feature.
  Plain-data `MotionState` + free functions (`createMotionModel`,
  `motionOnFix`, `motionTick`, `motionReset`), pure TS, injected time:
  - **Render delay**: adaptive `2 × median` of the inter-ARRIVAL gaps
    (rolling window of 8, active after 3), clamped 1.5–5 s, starting at
    3 s. The tick interpolates `dTarget` between two buffered snapped
    fixes at `now − delay`; past the buffer end it dead-reckons at the
    modeled speed (device smoothed speed, else the slope of the last two
    snapped fixes).
  - **Monotonic `dRender`**: behind the target it converges at
    `min(v + err/2 s, 1.5 × v)`; ahead of it (over-extrapolation exposed
    by a new fix) it freezes until reality catches up. Never decreases.
  - **Staleness**: no fix for 15 s → rendered speed decays linearly to 0
    over 3 s, `stale` raised. First fix after → one eased
    (cubic-out) fast-forward to the target capped at 1.5 s, regardless
    of gap size.
  - **Bearing**: route tangent at `dRender`, slerped over 300 ms via
    `shortestHeadingDelta` (359°→1° never spins the long way).
  - **Edge cases**: modeled speed < 0.5 m/s clamps to 0 (stationary GPS
    wander cannot creep the marker); `dRender ≥ totalLength` pins to the
    destination and raises `arrived`; tick Δt clamps at 250 ms (app
    pause handling is Step 7's job).
- `src/tracking/demo/TrackingDemo.tsx` — now runs the FULL pipeline
  (gate → snapper → motion model) on the replayed trace, rendering the
  smooth green bearing-rotated marker beside the naive per-fix marker.
  Wired into `MapScreen` inside `RnMapView` (`__DEV__`-gated, unchanged
  since Step 2).

### Decisions & deviations

1. **Functions + POJO state instead of a class.** Step 5 runs
   `motionTick` inside a Reanimated worklet; captured class instances
   don't survive the worklet boundary, plain objects + `"worklet"`
   functions do. `motionTick` allocates nothing.
2. **Speed while interpolating comes from the buffered trajectory slope**
   (the exact speed that reproduces the delayed trajectory); the device
   smoothed speed is used only when dead-reckoning past the buffer end,
   falling back to the last segment slope when it is NaN. This is a
   refinement of the spec's wording, in its spirit: between fixes the
   marker still advances by `speed × Δt`.
3. **dTarget itself advances every tick** (buffer interpolation on the
   delayed clock), so "new fix → compute dTarget" generalizes to "the
   target is a delayed, continuously-moving point". Freeze/catch-up
   semantics are exactly as specified relative to that target.
4. **A snapped sample behind the buffer tail** (off-route re-acquire
   behind the frozen d — see Step 3 note 3) is held at the previous d:
   the model freezes until the vehicle re-passes that point. `dRender`
   never decreases, even across re-acquire. If product prefers a reset
   there, the hook can call `motionReset` on `off_route → snapped`.
5. **Staleness runs on arrival (render-clock) time, not measurement ts**
   — a burst of buffered old fixes after a network hiccup should clear
   staleness the moment data flows again.
6. **Demo clocking:** the replay compresses wall time 4× but keeps
   original `ts`, so the demo drives the model with a data clock
   anchored at the first fix and running at replay speed — the model
   sees one consistent timeline (injected time by design). On loop the
   gate/snapper/model/clock all reset.
7. **Demo marker rendering is throttled setState (~30 Hz) in a leaf
   component** — explicitly NOT the production path (that is Step 5's
   Reanimated `animatedProps` work); it exists so the pipeline is
   visible on the map today, and only the leaf marker re-renders.

### Acceptance evidence

- `yarn test`: 5 suites, 64 tests green. Step 4-specific (13 tests):
  - main simulation: 10 m/s ground truth, irregular 1–5 s fixes (seeded
    LCG), 20% drops, one 30 s gap: `dRender` never decreases across
    ~11,000 ticks; rendered speed ≤ 1.5× ground truth on every tick
    outside the fast-forward; the fast-forward fires exactly around the
    resume fix; `stale` raises at +15 s and clears on resume; rendered
    speed is fully 0 by +3 s of decay; `dRender` never overtakes ground
    truth;
  - bearing: 350°→10° north-wrap route — per-tick steps < 15°, net
    rotation ≈ +20° (never −340°), settles on the new heading;
  - stationary wander clamp (d creeping 0.1 m/s → marker pinned),
    freeze-until-reality-catches-up after an over-extrapolated gap,
    adaptive delay (0.5 s gaps → 1.5 s floor, 1 s → 2 s, 4 s → 5 s cap,
    < 3 gaps → initial 3 s), NaN device speed → slope-derived
    dead-reckoning, arrival pin + `arrived`, `motionReset`.
- `npx tsc --noEmit`: still only the 9 pre-existing app errors; nothing
  in `src/tracking/**` or `MapScreen.tsx`.
- On-device visual check of the demo (smooth vs naive marker) pending —
  run the app and watch the Step 4 chip; formal frame-timing evidence is
  the Step 5 gate.

### On-device verification findings (Step 4 addendum)

1. **Reanimated babel plugin vs function hoisting.** On-device (dev
   client, Hermes) every `"worklet"` function declaration is rewritten
   by the Reanimated babel plugin into a `var x = function…` assignment,
   and same-module helpers are captured into the caller's closure at
   module-init time. A helper declared BELOW its caller is captured as
   `undefined` → `TypeError: undefined is not a function` at runtime
   (hit in `motionOnFix` → `median`). Jest is configured without that
   plugin, so tests can't catch it. Convention for `src/tracking`:
   worklet-called helpers are always defined ABOVE their callers
   (`geo.ts` `normalizeHeading`, `motionModel.ts` `median` /
   `modeledSpeedAt` reordered).
2. **No non-feature children inside react-native-maps.** The Step 2–4
   demo rendered its status chip (`<View>`) as a MapView child; on the
   New Architecture that fails Fabric mounting ("addViewAt: failed to
   insert view …") and took the whole activity down. The chip now lives
   in `TrackingDemoChip`, a sibling overlay outside the map, fed by a
   tiny module-level store; `TrackingDemo` renders map features only.
   (This also explains why the Step 2 demo showed a blank screen on
   device — it was never actually verified until now.)
3. **Demo route swapped to the real-world mock route** provided by the
   user (`testing/fixtures/mock-route.json` + `testing/mockRoute.ts`,
   ~7 km in the area the home map centers on). The replay trace along
   it is `testing/fixtures/mock-route-trace.json` (374 fixes,
   regenerate via `node src/tracking/testing/generateTraceFixture.js`);
   unit tests keep using the U-route trace. The route array was
   reversed per user feedback (drive starts at the west end,
   36.5994/-1.2656). The demo camera `fitToCoordinates` the route on
   mount, then gently follows the vehicle (recenter only after ~1.2 km
   of drift, so manual panning isn't fought). Per user feedback the
   demo now runs in `TrackingDemoOverlay` — a full-screen dev overlay
   hosting its OWN `RnMapView` with its own map ref, so the production
   map's driver-location recentering and the demo camera never fight;
   collapsible to a "tracking demo" pill. MapScreen mounts exactly one
   thing: `{__DEV__ && <TrackingDemoOverlay />}`.
4. **Metro on this Windows machine does not watch file changes** (no
   Watchman): after any JS edit, Metro must be restarted and the app
   force-stopped + relaunched, or it serves stale 1-module delta
   bundles. Cost half the debugging session — see project memory.
5. **On-device evidence (physical Android device, dev client):** chip
   shows `geometry: native` (Nitro MapsGeometry projections), adaptive
   delay 4.4–5.0 s against the replay's 1–5 s cadence, `snapped`
   throughout, 0 rejects on the clean trace, and `d` climbing
   monotonically (402 → 793 → 1160 m over ~18 s at ~10 m/s ≈ the 4×
   replay's ground truth). Smooth marker renders with route-tangent
   rotation, trailing the naive marker by the render delay as designed.
   No crashes, no demo errors in logcat across several full replays.

## Step 5 — Rendering (`useTrackedVehicle.ts` + `VehicleMarker.tsx`)

### What was built

- `src/tracking/useTrackedVehicle.ts` — the pipeline-to-UI hook.
  Threading model: gate → snapper → Nitro projection run on the JS
  thread per fix (~1 Hz); the accepted snapped fix crosses to the UI
  thread once via `runOnUI`; a Reanimated `useFrameCallback` advances
  `motionTick` at 60 Hz ON THE UI THREAD and writes lat/lng/bearing/
  opacity/dRender into shared values. The motion state object is
  cloned into a shared value once and is UI-thread-owned from then on.
  Low-frequency UI state (chip: dRender/delay/stale/arrived) comes
  back via `runOnJS` only when the 10 m-quantized dRender or a flag
  changes. Replay support via `setReplayClock` (wall→data mapping).
- `src/tracking/VehicleMarker.tsx` — both spec strategies:
  - PRIMARY `animatedProps` (shipped): `useAnimatedProps` writes
    coordinate/rotation/opacity straight to the native marker; `flat`,
    `anchor 0.5/0.5`, `tracksViewChanges={false}`. The marker mounts
    once after the first fix (Fabric dislikes appearing/disappearing
    map children) at the already-populated shared-value position.
  - FALLBACK `segmentAnimation` (implemented, not shipped): 150 ms
    JS tick calling the native `animateMarkerToCoordinate(coord, 150)`
    so equal-duration segments chain into continuous motion.
  - `TrackedRoutePolylines`: dimmed-behind / brand-green-ahead split at
    `dRender`, recomputed at most 2×/s and only after ≥ 10 m movement.
  - Staleness UI: opacity pulse (0.35–0.55) computed in the frame
    callback.
- `splitRouteAt` in `routeGeometry.ts` (pure, 5 new Jest tests: joint
  continuity, d=0/total pinning, clamping, length conservation).
- Demo rewired to the production path (`useTrackedVehicle` +
  `VehicleMarker` + `TrackedRoutePolylines`); the old 30 Hz setState
  scaffold marker is gone. Camera-follow: chained equal-duration
  (2.5 s) `animateCamera` glides on the demo's own map.

### Decisions & deviations

1. **`Animated.addWhitelistedNativeProps({coordinate, rotation,
   opacity})` is load-bearing.** Without it Reanimated treats them as
   "JS props" and dispatches every animatedProps update through the JS
   thread per frame — visually identical, but it needlessly burns JS
   CPU. Found via on-device thread profiling.
2. **The marker never remounts once mounted** (mount gate polls
   `hasFix` at 250 ms until the first fix): avoids both the Fabric
   addViewAt class of crashes and a (0,0) flash.
3. **animatedProps works on the Google provider** (New Architecture,
   react-native-maps 1.27.2) — the fallback strategy stays dormant.

### Acceptance evidence (on-device, DEV build — see caveat)

- Visual: green puck rides the route exactly at the polyline split
  point, rotation follows the tangent, camera glides after it,
  d climbing at replay ground-truth rate (4200 → 4559 m in ~8 s at 4×,
  spd ≈ 10 m/s), 170 accepted / 0 rejected, `geometry: native`,
  no crashes, no demo errors across full 8.8 km replays.
- JS-thread cost of the entire tracking pipeline ≈ 0: `mqt_v_js`
  measured with demo OPEN ≈ 66% vs demo CLOSED (baseline app alone)
  ≈ 64–72% — statistically identical. The high baseline is the app's
  own dev-mode load (Metro, dev client, LogBox, app providers), not
  the tracker.
- CAVEAT — formal gate still open: "sustained 60 fps while panning +
  JS < 30%" must be measured on a RELEASE build (dev-mode gfxinfo
  showed 18 ms median UI-thread frames / 78% janky, dominated by dev
  overhead; meaningless for the gate). Perfetto/gfxinfo capture on a
  release build is the remaining Step 5 acceptance item, alongside the
  frame-by-frame screen-recording uniform-displacement check.

### Step 5 — RELEASE-build acceptance evidence (gate closed)

Measured on the physical baseline device (Samsung, 720×1560), release
variant (`assembleRelease`, Hermes bytecode, no Metro/dev overhead),
demo temporarily force-enabled in release and debug-signed for a
data-preserving install — both TEMP edits reverted afterwards, debug
build reinstalled.

- **JS thread (`mqt_v_js`)**: 20–30% during steady tracking, 27–29%
  while continuously panning the map — **passes the < 30% gate**, and
  the earlier open-vs-closed A/B showed the tracking pipeline itself
  contributes ≈ 0 of that (it is app-baseline load: providers,
  ride-request polling).
- **Frames (gfxinfo, 30 s window with scripted panning swipes)**:
  1,604 frames, median 13 ms, 90th 19 ms, 95th 21 ms, 99th 27 ms,
  janky 18.3% (Missed Vsync: 1). Median comfortably inside the
  16.7 ms/60 fps budget while panning + full replay; the janky tail is
  dominated by swipe-start input frames and the ≤ 2 Hz polyline-split
  re-renders, and the measurement includes the demo harness overhead
  (80 fix-dot Circles, naive comparison marker, 4×-compressed chip
  updates) that the production overlay won't carry. Contrast with the
  dev build: 78% janky, 18 ms median — dev-mode numbers are noise.
- Visual (release): green puck rides the split point with
  `geometry: native`, 166 accepted / 0 rejected across the replay,
  no crashes.

Remaining niceties (not gate-blocking, folded into Step 6): a
frame-by-frame screen-recording uniform-displacement check, and a
perfetto trace if deeper attribution is ever needed.

## Step 6 — Replay harness & dev screen

### What was built

- `src/tracking/testing/traceTransforms.ts` — seeded, pure
  `applyHarnessFaults`: ~20% drops (first two fixes protected),
  out-of-order delivery swaps, duplicate re-deliveries, a 30 s gap
  (18–30% of the trace), a ~55 m off-route detour (40–54%), and
  accuracy degradation to 35–80 m with matching position noise
  (64–78%). Windows never overlap; a toggle combination replays
  identically every run.
- Harness UI in `TrackingDemoOverlay`: speed selector (1×/4×/16×),
  restart, and the six fault toggles. Any change remounts the demo —
  fresh gate/snapper/motion model/replay, deterministic from t=0.
- Debug overlay per spec: RED dots = raw deliveries (including
  corrupted/rejected ones), BLUE dots = snapped positions, the green
  puck = dRender; chip gained a single state readout
  (tracking / STALE / OFF-ROUTE / arrived) and a 1 Hz "fix age".
- README: "Tracking replay harness" section for QA — controls table
  mapping each toggle to the Step 2–5 scenario it reproduces.

### Decisions & notes

1. **Config changes remount rather than mutate** — a keyed remount is
   the only reset that provably clears every stage (gate seq state,
   snapper streaks, motion buffer, replay clock anchor).
2. **The detour's hard 55 m entry step gets its first offset fix
   rejected as `teleport`** (implied speed across the step exceeds
   42 m/s at short cadences); subsequent offset fixes are mutually
   consistent, are accepted, and drive the off-route streak. Correct
   layered behavior — the chip shows both (`last: teleport` during
   entry, then OFF-ROUTE).
3. Raw-dot keys are per-delivery, not per-seq — duplicates share a seq
   and would collide as React keys otherwise.

### Acceptance evidence

- `yarn test`: 7 suites, 77 tests green. Step 6-specific (8): each
  transform verified individually through the REAL gate+snapper
  pipeline (duplicates/out-of-order rejected exactly, gap ≥ 30 s,
  accuracy rejections only in-window, detour → off_route → re-acquire,
  determinism, all-faults-on survival).
- On-device (dev build, 4× replay, dup seq + detour + 30 s gap on):
  chip live-reported `rejected N (last: duplicate_seq)` and
  `(last: teleport)` during detour entry; **`OFF-ROUTE · d 4200 m`**
  with red/blue dots visibly offset from the polylines and the puck
  frozen at the last snapped d; fix age ticked 0→12 s through the
  trace's natural gap; speed/restart toggles remount cleanly; zero
  crashes or demo errors in logcat.
- Burst screenshots missed the exact STALE seconds of the 30 s-gap
  window (7.5 s wall at 4×) — the stale/decay/fast-forward behavior is
  deterministically covered by the Step 4 simulation tests and is
  reproducible from the screen with the `30s gap` toggle (QA: watch
  fix age climb past 15 s data-time and the puck dim).

## Step 7 — App lifecycle & integration hardening (final step)

### What was built

- `motionOnForeground` (`motionModel.ts`) — on background → foreground:
  discards the interpolation clock (next tick Δt = 0, so a backlogged
  wall-clock delta can never become motion) and arms ONE capped, eased
  fast-forward to wherever the buffered fixes say the vehicle is. The
  backlog is never replayed in real time. If nothing arrived while
  backgrounded, the existing staleness machinery handles it (decay,
  then fast-forward on the next fix).
- `useTrackedVehicle` wiring:
  - AppState listener → `motionOnForeground` via `runOnUI`;
  - LEG SWITCH: a new `table` rebuilds gate/snapper/motion (fresh
    monotonic clamp), resets `hasFix`/UI state, and immediately
    re-projects the last accepted fix on the new route with a
    full-route search — the marker re-acquires where the vehicle
    physically is, never behind;
  - dev leak detector: `getActiveTrackedVehicleCount()` (1:1 with
    registered frame callbacks), surfaced on the harness chip.
- `flags.ts` — `SMOOTH_VEHICLE_TRACKING` from Firebase Remote Config
  (already fetched/activated at startup by RemoteConfigProvider).
  Fails CLOSED (naive marker) on any error; dev builds default ON;
  `__setSmoothTrackingOverride` for tests.
- `VehicleTracker.tsx` — the flag-gated production entry point
  (map child): FixSource + encoded polyline in; smooth pipeline
  (marker + optional split polylines) or the NAIVE per-fix marker
  out. Flag sampled once per mount so a mid-trip flip can't tear the
  pipeline down. New `encodedPolyline` = leg switch.

### Decisions & deviations

1. **Foreground fast-forward reuses the Step 4 ff mechanism** — one
   code path for "resume after gap" and "resume after background",
   same 1.5 s cap, same easing. `ffActive` is cleared first so an
   in-flight fast-forward re-targets rather than finishing stale.
2. **Leg-switch placement is a hard set, not an animation** — the
   re-projected position is at most the render-delay lag (~40–60 m)
   ahead of the last rendered point, physically continuous, and a
   Jest test pins it (< 80 m, forward-only afterwards).
3. **The flag is read lazily, not through RemoteConfigProvider's
   context** — the provider's typed AppConfig is URL-focused; the
   pipeline flag reads the already-activated RC value directly and
   fails closed.

### Acceptance evidence

- `yarn test`: 8 suites, 81 tests green. Step 7-specific (4):
  - fixes-during-background sim: 60 s of buffered fixes, ticks
    suspended; on foreground the first tick moves 0 m (clock discard),
    dRender never decreases, and ~550 m of catch-up completes inside
    the 1.5 s fast-forward (vs a 1.5× crawl budget of 24 m);
  - silent-background sim: stale immediately on resume, decay stops
    within budget, next fix triggers the capped fast-forward;
  - leg-switch continuity: U-route split into two legs, driven through
    the real gate → snapper → model pipeline; rendered position moves
    < 80 m across the switch and is forward-only after;
  - flag fails closed under Node (no firebase, no __DEV__), override
    works.
- On-device (dev build):
  - 20× overlay open/close cycles: chip shows `hooks 1`, zero crashes
    — no leaked frame callbacks/hook instances;
  - 60 s background (replay kept delivering: accepted 31 → 112) →
    foreground: dRender jumped 809 m → 3463 m in one capped eased
    fast-forward (a 1.5× crawl would have taken ~7 minutes), chip
    healthy (`fix age 0 s`, `hooks 1`), zero FATALs in logcat.
- Leg switching has no in-app UI yet (multi-stop trips are future
  product work) — the behavior is pinned by the Jest continuity test
  and `VehicleTracker` treats a new `encodedPolyline` as the switch.

**This completes REALTIMETRACKING.md Steps 1–7.** Production
integration = render `<VehicleTracker source={...}
encodedPolyline={...} />` inside the trip MapView and set the
`SMOOTH_VEHICLE_TRACKING` Remote Config flag.

## Production integration — MapScreen (post-spec)

### What was wired

- `src/tracking/driverFixSource.ts` — FixSource over the native
  Kalman-filtered GPS stream (`onGeoKalman`). seq = module-level
  monotonic counter (single-device in-order delivery), ts = arrival
  wall clock (OnGpsData carries no measurement timestamp).
- `VehicleTracker` gained `routePoints` (decoded routes like
  `ride_line_str`; re-encoded internally so the Nitro module stays the
  geometry authority) and `routeColors`; `TrackedRoutePolylines` gained
  ahead/behind color props. Missing/short route → naive marker.
- `MapScreen`:
  - ACTIVE LEG = `driver_to_pickup_line_str` until
    `rideStatus.hasRideStarted`, then `ride_line_str`. A leg change is
    a new `routePoints` array → VehicleTracker leg-switch (rebuild +
    re-project, Step 7).
  - Marker: `<VehicleTracker>` (same top-view car icons via
    `getVehicleTopViewIcon`, `rideType 'boda'` for Bike) when the flag
    is on AND a ride with a route is active; otherwise the existing
    `MapCarIcon` — which also remains the no-ride marker and the
    flag-off fallback.
  - Polylines, phase-aware: ride line renders statically as a preview
    while heading to pickup, and is replaced by the tracker's
    traveled/ahead split once the ride starts; the driver→pickup line
    disappears the moment the ride starts and, while active, is drawn
    either by the tracker (split, green) or statically (flag off).
    Split colors match the app theme (green_500 pickup leg,
    primary_500 ride leg).
- The dev demo overlay was REMOVED from MapScreen per user decision;
  the harness component remains at `src/tracking/demo/TrackingDemo.tsx`
  (README updated: mount `<TrackingDemoOverlay />` temporarily for QA).

### Verified

- 81 Jest tests green, tsc clean (9 pre-existing app errors only).
- On-device (no-ride path): map screen boots and behaves exactly as
  before — no demo overlay, MapCarIcon behavior unchanged, zero
  crashes.
- The RIDE path (tracker snapping the pickup/ride legs live) needs a
  real ride against the backend — not exercisable from this machine
  (backend tunnel offline). Smoke-test on the next test ride: expect
  the car icon to glide on the route, the active leg to dim behind the
  car, the pickup line to vanish on ride start, and a single
  fast-forward on foregrounding.

### Integration fixes (on-device, real ride)

1. **Invisible car marker → `tracksViewChanges` settle window.** The
   VehicleMarker set `tracksViewChanges={false}` from first render. On
   Android react-native-maps rasterizes the marker child into a bitmap
   ONCE when that is false; an `<Image>` icon still decoding at that
   instant captures BLANK. The demo's styled `<View>` puck was
   synchronous so it never showed the bug; the real car PNG did.
   Fix: `useIconSettle` keeps tracksViewChanges true for 1.5 s after
   mount (and on icon change) so the image paints, then false for fps.
2. **Pickup-leg polyline too dull.** Traveled/behind defaulted to a
   near-transparent grey; ahead used green_500 (mid). Now phase-aware
   bright shades: pickup = green_400 ahead / green_700 behind, ride =
   primary_400 / primary_700; widths bumped to 6/5 to match the app's
   other polylines.
