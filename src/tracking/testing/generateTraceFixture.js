// Regenerates the committed trace fixture. Run from the repo root:
//   node src/tracking/testing/generateTraceFixture.js
//
// The route below is U_ROUTE_POINTS from fixtures.ts (kept in sync by
// the fixtures test); duplicated here because this script runs in plain
// node, which cannot import the TS module.
const fs = require("fs");
const path = require("path");
const { generateTrace } = require("./traceGenerator");

const U_ROUTE_POINTS = [
  { latitude: -1.3, longitude: 36.8 },
  { latitude: -1.298, longitude: 36.8 },
  { latitude: -1.295, longitude: 36.80005 },
  { latitude: -1.292, longitude: 36.8 },
  { latitude: -1.29, longitude: 36.8 },
  { latitude: -1.2899, longitude: 36.80015 },
  { latitude: -1.29, longitude: 36.8003 },
  { latitude: -1.292, longitude: 36.8003 },
  { latitude: -1.295, longitude: 36.80025 },
  { latitude: -1.298, longitude: 36.8003 },
  { latitude: -1.3, longitude: 36.8003 },
];

const trace = generateTrace(U_ROUTE_POINTS, { seed: 42 });
const outPath = path.join(__dirname, "fixtures", "nairobi-sim-trace.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(trace, null, 1) + "\n");
console.log(`Wrote ${trace.length} fixes to ${outPath}`);

// Demo trace along the real-world mock route (the area the home map
// centers on) — used by TrackingDemo; unit tests keep the U-route trace.
const mockRoute = require("./fixtures/mock-route.json");
const mockTrace = generateTrace(mockRoute, { seed: 7 });
const mockOut = path.join(__dirname, "fixtures", "mock-route-trace.json");
fs.writeFileSync(mockOut, JSON.stringify(mockTrace, null, 1) + "\n");
console.log(`Wrote ${mockTrace.length} fixes to ${mockOut}`);
