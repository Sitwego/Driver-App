# REALTIMETRACKING.md — Client Implementation Prompt (React Native)

> **How to use this file:** Paste the entire document into Claude / Codex as the opening prompt. Work through the steps **in order**. Each step is gated: do not proceed until the acceptance criteria of the current step pass. If unsure about a decision, ask before writing code. **Scope is the client app only** — no backend work.

---

## 1. Role & Objective

You are a senior React Native engineer implementing **production-grade real-time vehicle tracking** in a ride-hailing app (Sitwego, Nairobi). The app receives **raw GPS fixes** for a vehicle and must render a **smoothly animated marker** on `react-native-maps`, visually locked onto the trip's **route polyline**, moving like a real vehicle: forward along the road, at plausible speed, with correct heading.

The naive approach — setting the marker coordinate on every incoming fix — is explicitly unacceptable. Raw GPS is noisy (5–30 m urban error), arrives at irregular intervals (1–5 s, with gaps of 10–60 s on poor networks), can arrive out of order, and can jump sideways or backward. All smoothing intelligence lives **on the client**. Treat the fix source as a given input; your job starts at the moment a fix enters the app.

## 2. Stack & Constraints

- React Native **New Architecture**, Hermes, TypeScript.
- `react-native-maps` (Google provider on Android).
- **Reanimated 3** for all animation. No `setState`-per-frame, no `Animated` timing loops on the JS thread.
- `react-native-gesture-handler` available.
- Target device baseline: mid-range Android (Redmi/Tecno class). 60 fps while the map pans is the bar.
- **`com.google.maps.android:android-maps-utils:3.19.1`** is in the Android build and is the geometry authority: use `PolyUtil` (decode, `isLocationOnEdge`, `locationIndexOnPath`) and `SphericalUtil` (`computeDistanceBetween`, `computeHeading`, `interpolate`, `computeOffset`) instead of hand-rolling spherical math. Expose what's needed via a **Nitro Module (Kotlin)**; mirror on iOS with `Google-Maps-iOS-Utils` (`GMSGeometryUtils`: `GMSGeometryDistance`, `GMSGeometryHeading`, `GMSGeometryInterpolate`) behind the same TS interface.
- **Threading rule for the native geometry:** native calls are for **one-time preprocessing and per-fix work** (a few calls per second). The **per-frame** hot path (`pointAt(dRender)` at 60 Hz) must NOT cross a bridge — it reads a precomputed table in TS/worklet. Any design that calls native code per frame is rejected.
- Native modules beyond the geometry wrapper above are allowed **only** if profiling proves TS is too slow.
- The route polyline for the trip is available up front as an encoded polyline string (Google encoding, precision 5).

## 3. Input Contract

Fixes arrive through a single injected callback (transport-agnostic — could be SSE, WebSocket, or a local mock):

```ts
interface LocationFix {
  seq: number;   // monotonic counter — the ordering authority
  ts: number;    // device epoch ms when the fix was measured
  lat: number;
  lng: number;
  acc: number;   // horizontal accuracy, meters
  spd: number;   // m/s (may be 0/NaN on some devices)
  brg: number;   // degrees course-over-ground (may be garbage at low speed)
}

type FixSource = (onFix: (fix: LocationFix) => void) => Unsubscribe;
```

Design everything against `FixSource` so a **replay/mock source** and the real network source are interchangeable. This is non-negotiable — it is what makes every step below testable.

## 4. Client Pipeline (target architecture)

```
FixSource
  └─ 1. Ingest gate: dedupe (seq), drop stale/inaccurate/teleport fixes
      └─ 2. Snap-to-polyline: fix → distance-along-route d (meters)
          └─ 3. Motion model: render clock ~3 s in the past,
                dead-reckon d between fixes, never move backward
              └─ 4. d → (lat, lng, bearing) via precomputed route table
                  └─ 5. Reanimated shared values → Marker + traveled-polyline UI
```

Modules must be separable and unit-testable: `ingestGate.ts`, `routeGeometry.ts`, `snap.ts`, `motionModel.ts`, `useTrackedVehicle.ts` (hook wiring it together), `VehicleMarker.tsx`.

## 4.1 Smoothness Contract (the definition of done for the whole feature)

"Smooth" is not a vibe; it is these testable properties, and every step exists to serve them:

1. **Continuity:** the marker has a new, distinct position **every rendered frame** while the vehicle moves (target 60 Hz; never below the display refresh the map itself achieves). Movement is per-frame interpolation along the route — never a per-fix hop, never a CSS-like "animate to next point then wait".
2. **Constant-velocity feel:** between fixes the marker moves at the modeled speed; on new data it *converges* (speed scaling ≤ 1.5×), it does not jump. Screen-space displacement per frame changes gradually — no visible acceleration spikes except the single capped fast-forward after a long gap.
3. **Monotonic forward motion:** the marker never moves backward along the route, never sidesteps off the polyline while snapped, never oscillates.
4. **Rotation continuity:** heading changes are slerped (~300 ms, shortest arc); the icon never flips or spins the long way around at the 0°/360° wrap.
5. **Zero perceptible teleports:** any correction > 5 m of screen movement must be expressed as an eased, speed-capped animation.
6. **Independence from data cadence:** whether fixes arrive at 1 s or 5 s intervals, rendered motion quality is identical — the render-delay buffer (Step 4) absorbs the difference.

If a proposed implementation choice conflicts with any clause above, the choice is wrong — revisit it, don't relax the contract.


## 5. Implementation Steps (gated)

### Step 1 — Route geometry (`routeGeometry.ts` + Nitro `MapsGeometry` module)
**Build:** a one-time preprocessing pass per route, executed natively, producing a plain data table consumed by TS/worklets at frame rate.

Native side (Nitro, Kotlin wrapping `android-maps-utils`; Swift wrapping `GMSGeometryUtils`):
- `prepareRoute(encodedPolyline) → { lats: number[], lngs: number[], cumDist: number[], bearings: number[], totalLength: number }` — `PolyUtil.decode`, then per-segment `SphericalUtil.computeDistanceBetween` (cumulative) and `SphericalUtil.computeHeading`. One call per route/leg; the returned arrays live in JS from then on.
- `projectOnPath(lat, lng, startIdx, endIdx) → { d, perpendicularM, segmentIndex }` — segment-constrained nearest-point projection (use `PolyUtil.distanceToLine` per segment within the window, or port `locationIndexOnPath`'s logic with a window). Called per accepted fix (~1/s), so a native call is fine here.

TS side (`routeGeometry.ts`):
- `pointAt(d) → { lat, lng, bearing }` — binary search on `cumDist` + linear lat/lng interpolation between vertices, bearing from the `bearings` table. This is the 60 Hz path: pure array math, worklet-safe, no native calls. (Linear interpolation instead of `SphericalUtil.interpolate` is acceptable — segment lengths are tens of meters; error is sub-centimeter.)
- Window clamping helpers and total length.

**Accept when:** unit tests verify `pointAt(projectOnPath(p).d)` round-trips within 1 m for on-route points; projection of a point equidistant from an out-leg and return-leg of a U-shaped route resolves to the leg inside the window; `pointAt` at 60 Hz allocates nothing per call (reuses an output object) and 10,000 calls complete in < 20 ms on Hermes; the Nitro module has an iOS implementation or an explicit documented Android-first stub.

### Step 2 — Ingest gate (`ingestGate.ts`)
**Build:** a pure function/class that accepts raw fixes and emits accepted ones. Drop — never repair — bad input:
- Duplicate or non-increasing `seq`.
- `acc > 50` m.
- Implied speed vs. last accepted fix > 42 m/s (~150 km/h) — teleport filter.
- `ts` regressions > 2 s (clock weirdness).
- Optionally maintain a light exponential smoothing of `spd` (raw device speed is jumpy), and discard `brg` when `spd < 1.5 m/s` (GPS bearing is garbage while slow — bearing will come from the polyline anyway).

**Accept when:** table-driven unit tests cover every rule; feeding a recorded real trace (record one from a device, commit it as a fixture JSON) rejects < 10% of points; feeding a synthetic corrupted trace (injected duplicates, jumps, backward points) rejects exactly the corrupted points.

### Step 3 — Snap-to-polyline (`snap.ts`)
**Build:** stateful snapper on top of `routeGeometry.project`:
1. Search window = last snapped `d` − 100 m … + 500 m (full-route search only for the very first fix).
2. Snapped `d` must be **monotonically non-decreasing**. A projection behind the current `d` (within GPS noise) clamps to current `d`.
3. **Off-route detection:** perpendicular distance > 30 m for 5 consecutive accepted fixes → emit `offRoute` state; while off-route, pass through raw fixes and widen the re-acquire search; snap back when 3 consecutive fixes project within 20 m. (Threshold 45 m instead of 30 m when `rideType === 'boda'` — motorcycles legitimately leave the road network.)

**Accept when:** replaying the real trace, `d` never decreases; a synthetic detour trace triggers `offRoute` and later re-acquires; the U-turn/loop fixture never snaps to the wrong leg.

### Step 4 — Motion model (`motionModel.ts`)
**Build:** the heart of the feature. A small state machine advanced by a per-frame `tick(nowMs)`:
- **Render delay:** render the vehicle ~2× the median observed fix interval in the past (start fixed at 3,000 ms; make it adaptive from a rolling window of inter-fix gaps, clamped 1.5–5 s). This means the marker is almost always *interpolating between two known snapped positions*, not guessing.
- Between fixes, advance `dRender` by `speed × Δt` (speed = smoothed `spd`, or derived from the last two snapped fixes if device speed is unusable).
- New fix arrives → compute `dTarget`. If behind, catch up by scaling speed up to **1.5×** until converged — never jump. If `dRender > dTarget` (over-extrapolated), **freeze** until reality catches up. `dRender` never decreases. Ever.
- **Gap handling:** no accepted fix for 15 s → decay speed to 0 over 3 s (vehicle appears stopped) and expose a `stale: true` flag for the UI. When fixes resume after a long gap, fast-forward `dRender → dTarget` with an eased animation capped at 1,500 ms, regardless of gap size.
- Bearing: from `pointAt(dRender).bearing`, slerped over ~300 ms (shortest-arc; handle the 359°→1° wrap).

This module must be **pure TS with injected time** — no Reanimated imports — so it can be tested deterministically.

**Accept when:** a simulation test drives it with irregular 1–5 s fixes + 20% drops + one 30 s gap, asserting: `dRender` never decreases; instantaneous rendered speed never exceeds 1.5× ground truth (except the capped fast-forward); the stale flag toggles correctly; bearing wrap test passes.

### Step 5 — Rendering (`useTrackedVehicle.ts` + `VehicleMarker.tsx`)
**Build:** wire the pipeline to the UI. This step is where smoothness is usually lost on `react-native-maps`, so the marker-driving strategy is prescribed:

- **Do NOT set `coordinate` as a plain prop per frame.** Prop updates go through React reconciliation → visible stutter and dropped frames on Android. This is the number-one failure mode; treat any per-frame `setState`/prop path as an automatic rejection.
- **Primary strategy (frame-driven):** a Reanimated `useFrameCallback` runs `motionModel.tick` and `pointAt(dRender)`, writing `lat/lng/bearing` into shared values; drive the marker via `useAnimatedProps` on the native marker component (New Architecture) so updates flow directly to the native view without React renders. Rotation via the same path.
- **Fallback strategy (segment-animation), only if animatedProps on `<Marker>` proves unreliable on the Google provider:** keep the motion model ticking at a coarser 100–200 ms cadence and, on each tick, call the native marker animation — `MarkerAnimated`/`AnimatedRegion.timing(..., {useNativeDriver: false})` on iOS and the marker's native `animateMarkerToCoordinate(coord, durationMs)` on Android — with duration equal to the tick interval and **linear easing**, so consecutive segment animations chain into visually continuous motion (each animation ends exactly when the next begins; any easing curve other than linear produces per-tick pulsing).
- Whichever strategy ships, capture frame-timing evidence for both on the baseline device and document the decision in `NOTES.md`.
- Marker config: `flat`, `anchor={{x:0.5,y:0.5}}`, `tracksViewChanges={false}` with a rasterized vehicle icon (re-enable for exactly one frame when the icon asset changes, then off again — leaving it on redraws the marker every map frame and tanks fps).
- **Traveled-route dimming:** split the route into two `<Polyline>`s at `dRender` (behind = dimmed, ahead = brand green `#6b9f77`). Recompute the split at most 2×/s, not per frame — polyline re-render is expensive and would violate the smoothness contract by stealing frame budget.
- Staleness UI: subtle pulsing/greyed marker when `stale`.

**Accept when:** on a mid-range Android device with the map being panned, sustained 60 fps (perfetto / RN performance monitor evidence); JS thread < 30% during steady tracking; frame-by-frame screen recording of a straight-line segment shows uniform marker displacement (no pulsing at tick boundaries — this specifically validates the chaining if the fallback strategy is used); no marker flicker; rotation through North shows no long-way spin; polyline split visibly tracks the marker without stutter.

### Step 6 — Replay harness & dev screen
**Build:** a hidden dev screen with a mock `FixSource` that replays fixture traces at selectable speed (1×/4×/16×), with toggles to inject: dropped fixes, out-of-order delivery, duplicate seq, a 30 s gap, an off-route detour, and accuracy degradation. Show live debug overlay: raw fix (red dot), snapped position (blue), `dRender` marker, current state (tracking / stale / off-route), fix age.

**Accept when:** every Step 2–5 acceptance scenario can be reproduced visually from this screen; the harness is documented in the README so QA can use it.

### Step 7 — App lifecycle & integration hardening
**Build:**
- On `AppState` background → foreground: discard the interpolation state's notion of "now", take the latest available fix as truth, and fast-forward (≤ 1.5 s animation) — never replay the backlog in real time.
- Trip leg changes (multi-stop): on new polyline, rebuild geometry, project current raw position fresh (full-route window), reset the monotonic clamp.
- Cleanup: unsubscribing the hook cancels the frame callback and drops all references (verify no leaked frame callbacks after unmount, e.g. via a counter in dev builds).
- Feature flag the whole pipeline with fallback to the current naive marker.

**Accept when:** background 60 s → foreground shows a single smooth fast-forward; navigating away/back to the trip screen 20× leaks nothing; leg switch does not cause a backward jump.

## 6. Edge-Case Checklist (must be handled, most are covered above — verify each)

- Out-of-order / duplicate fixes.
- `spd = 0` or `NaN` from cheap GPS chips → derive speed from consecutive snapped fixes.
- GPS bearing garbage at low speed → polyline tangent is the only bearing source while snapped.
- Vehicle stationary at pickup: GPS wander must not creep the marker forward (clamp `dRender` advance when smoothed speed < 0.5 m/s).
- Route with a hairpin/U-turn (window search, Step 1 fixture).
- Very short routes (< 200 m) — window bounds must clamp, not wrap.
- Marker at exactly `d = routeLength` (arrival): pin to destination, stop ticking.

## 7. Non-Goals (do not build)

- Any backend/transport work — `FixSource` is the boundary.
- Kalman/IMU fusion on this app (fixes are assumed pre-filtered upstream).
- Hand-rolled haversine/projection implementations where `android-maps-utils` / `GMSGeometryUtils` already provide the primitive (the only exception is the frame-rate `pointAt` interpolation, per Step 1).
- Server-side or third-party map-matching services.
- ETA computation.

## 8. Deliverables per Step

For every step: (1) code, (2) tests (Jest for pure modules; the replay harness for visual criteria), (3) a short `NOTES.md` entry explaining decisions and any deviation from this spec, (4) acceptance evidence (test output or profiling capture). Then **stop and wait for review** before the next step. for some reference check this "C:\mobility-customer\src\tracking"