// ----------------------------------------------------------------
// Google encoded-polyline codec (precision 5).
//
// decode() mirrors PolyUtil.decode / GMSPath(fromEncodedPath:) so the
// TS fallback produces the exact same vertices as the native module.
// encode() exists for tests and the replay harness (building fixture
// routes from coordinate lists).
// ----------------------------------------------------------------

import type { LatLng } from "./types";

export function decodePolyline(encoded: string): LatLng[] {
  const path: LatLng[] = [];
  const len = encoded.length;
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let result = 1;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 1;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    // Divide (correctly rounded) instead of multiplying by the inexact
    // 1e-5 — keeps decoded values bit-identical to JS number literals.
    path.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return path;
}

export function encodePolyline(path: readonly LatLng[]): string {
  let out = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const point of path) {
    const lat = Math.round(point.latitude * 1e5);
    const lng = Math.round(point.longitude * 1e5);
    out += encodeSignedValue(lat - prevLat);
    out += encodeSignedValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

function encodeSignedValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}
