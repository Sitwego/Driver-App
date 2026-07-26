// ----------------------------------------------------------------
// Deterministic GPS-trace generator (test fixture tooling).
//
// Produces a realistically noisy urban drive along a polyline:
// irregular 1–5 s fix intervals, occasional multi-second gaps,
// gaussian position noise scaled to the reported accuracy, cheap-chip
// speed quirks (spd = 0), bearing garbage at low speed, a mid-route
// traffic stop, and occasional upstream seq drops.
//
// CommonJS on purpose: runnable by plain `node` to (re)generate the
// committed fixture, and loadable by Jest/Metro all the same.
// Regenerate with:
//   node src/tracking/testing/generateTraceFixture.js
// ----------------------------------------------------------------

/** Mean Earth radius (meters) — matches src/tracking/geo.ts. */
const EARTH_RADIUS_M = 6371009;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Deterministic 32-bit PRNG. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal sample (Box–Muller). */
function gaussian(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function haversineM(a, b) {
  const phi1 = a.latitude * DEG2RAD;
  const phi2 = b.latitude * DEG2RAD;
  const dPhi = (b.latitude - a.latitude) * DEG2RAD;
  const dLambda = (b.longitude - a.longitude) * DEG2RAD;
  const sp = Math.sin(dPhi / 2);
  const sl = Math.sin(dLambda / 2);
  const h = sp * sp + Math.cos(phi1) * Math.cos(phi2) * sl * sl;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function headingDeg(a, b) {
  const phi1 = a.latitude * DEG2RAD;
  const phi2 = b.latitude * DEG2RAD;
  const dLambda = (b.longitude - a.longitude) * DEG2RAD;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const deg = Math.atan2(y, x) * RAD2DEG;
  return deg < 0 ? deg + 360 : deg;
}

/** Builds cumulative distances for a vertex list. */
function cumulative(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversineM(points[i - 1], points[i]));
  }
  return cum;
}

/** Position + tangent bearing at distance d along the polyline. */
function pointAt(points, cum, d) {
  const total = cum[cum.length - 1];
  const clamped = Math.min(Math.max(d, 0), total);
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] <= clamped) i++;
  const segLen = cum[i + 1] - cum[i];
  const t = segLen > 0 ? (clamped - cum[i]) / segLen : 0;
  const a = points[i];
  const b = points[i + 1];
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
    bearing: headingDeg(a, b),
  };
}

/** Offsets a coordinate by east/north meters (equirectangular). */
function offsetMeters(point, eastM, northM) {
  const dLat = (northM / EARTH_RADIUS_M) * RAD2DEG;
  const dLng =
    (eastM / (EARTH_RADIUS_M * Math.cos(point.latitude * DEG2RAD))) * RAD2DEG;
  return {
    latitude: point.latitude + dLat,
    longitude: point.longitude + dLng,
  };
}

/**
 * Generates a deterministic trace of LocationFix objects along `route`.
 *
 * @param {Array<{latitude:number, longitude:number}>} route
 * @param {object} [options]
 * @param {number} [options.seed]
 * @param {number} [options.startTs] epoch ms of the first fix
 * @returns {Array<{seq:number, ts:number, lat:number, lng:number, acc:number, spd:number, brg:number}>}
 */
function generateTrace(route, options = {}) {
  const { seed = 42, startTs = 1760000000000 } = options;
  const rng = mulberry32(seed);
  const cum = cumulative(route);
  const total = cum[cum.length - 1];

  const CRUISE = 10; // m/s ~ 36 km/h urban
  const ACCEL = 1.5; // m/s^2
  const stopAtD = total * 0.55; // mid-route traffic stop
  const STOP_S = 20;

  const fixes = [];
  let d = 0;
  let speed = 0;
  let t = 0; // seconds since trace start
  let seq = 100;
  // Traffic-stop phases: drive → brake at stopAtD → wait STOP_S → drive on.
  let stopPhase = "before"; // before | braking | waiting | done
  let stopRemaining = 0;

  // The hard iteration cap guards against kinematics deadlocks — this
  // generator OOM'd once by stalling short of a waypoint; never again.
  for (let iter = 0; iter < 5000 && d < total - 0.5; iter++) {
    // Irregular fix cadence: mostly 1–3 s, occasionally a 4–8 s gap,
    // and exactly one long 12 s gap mid-route.
    let dt;
    const roll = rng();
    if (fixes.length === 40) dt = 12;
    else if (roll < 0.1) dt = 4 + rng() * 4;
    else dt = 1 + rng() * 2;

    // Advance simple kinematics in 0.25 s sub-steps.
    const steps = Math.max(1, Math.round(dt * 4));
    for (let s = 0; s < steps; s++) {
      const sub = dt / steps;
      const brakingDist = (speed * speed) / (2 * ACCEL);

      if (stopPhase === "before" && d + brakingDist >= stopAtD) {
        stopPhase = "braking";
      }
      if (stopPhase === "braking" && speed <= 0.05) {
        stopPhase = "waiting";
        stopRemaining = STOP_S;
      }
      if (stopPhase === "waiting") {
        stopRemaining -= sub;
        if (stopRemaining <= 0) stopPhase = "done";
        speed = 0;
        continue;
      }

      let target = CRUISE;
      if (stopPhase === "braking") target = 0;
      // Final approach: slow down, but creep at 0.8 m/s so the trace always
      // terminates instead of asymptotically stalling short of the end.
      const distToEnd = total - d;
      if (stopPhase !== "braking" && distToEnd < brakingDist + 3) target = 0.8;

      speed +=
        Math.sign(target - speed) * Math.min(ACCEL * sub, Math.abs(target - speed));
      d = Math.min(d + speed * sub, total);
    }
    t += dt;

    // Truth → noisy measurement.
    const truth = pointAt(route, cum, d);
    const acc = 4 + rng() * (rng() < 0.15 ? 31 : 14); // mostly 4–18 m, tail to 35 m
    const sigma = acc / 2.5;
    const noisy = offsetMeters(truth, gaussian(rng) * sigma, gaussian(rng) * sigma);

    const spdQuirk = rng() < 0.15; // cheap chips report 0 while moving
    const spd = spdQuirk ? 0 : Math.max(0, speed + gaussian(rng) * 0.6);
    const brg =
      speed < 1.5
        ? rng() * 360 // COG is garbage while slow
        : (truth.bearing + gaussian(rng) * 8 + 360) % 360;

    // Occasionally the upstream pipeline drops a fix entirely (seq skips).
    seq += rng() < 0.06 ? 2 : 1;

    fixes.push({
      seq,
      ts: startTs + Math.round(t * 1000),
      lat: Number(noisy.latitude.toFixed(7)),
      lng: Number(noisy.longitude.toFixed(7)),
      acc: Number(acc.toFixed(1)),
      spd: Number(spd.toFixed(2)),
      brg: Number(brg.toFixed(1)),
    });
  }

  return fixes;
}

module.exports = { generateTrace, mulberry32, gaussian };
