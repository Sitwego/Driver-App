package com.margelo.nitro.mapsgeometry

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.PolyUtil
import com.google.maps.android.SphericalUtil

/**
 * Kotlin implementation of the MapsGeometry Nitro hybrid object.
 *
 * Geometry authority for the tracking pipeline: android-maps-utils
 * (PolyUtil / SphericalUtil). Called once per route (prepareRoute) and
 * once per accepted GPS fix (projectOnPath, ~1 Hz) — never per frame.
 *
 * The instance keeps the decoded route so projectOnPath crosses the
 * JSI/JNI boundary with four scalars only.
 *
 * Class must live in this package with this exact name and a default
 * constructor — nitrogen's generated MapsGeometryOnLoad.cpp looks up
 * "com/margelo/nitro/mapsgeometry/HybridMapsGeometry" by descriptor.
 */
@DoNotStrip
@Keep
class HybridMapsGeometry : HybridMapsGeometrySpec() {

  private var points: List<LatLng> = emptyList()
  private var cumDist: DoubleArray = DoubleArray(0)

  override fun prepareRoute(encodedPolyline: String): NativeRouteTable {
    val decoded = PolyUtil.decode(encodedPolyline)

    // Drop consecutive duplicate vertices — zero-length segments break
    // projection math. Mirrors buildRouteTable() in routeGeometry.ts.
    val pts = ArrayList<LatLng>(decoded.size)
    for (p in decoded) {
      val last = pts.lastOrNull()
      if (last != null && last.latitude == p.latitude && last.longitude == p.longitude) continue
      pts.add(p)
    }
    require(pts.size >= 2) {
      "prepareRoute: route needs at least 2 distinct points, got ${pts.size}"
    }

    val n = pts.size
    val lats = DoubleArray(n)
    val lngs = DoubleArray(n)
    val cum = DoubleArray(n)
    val bearings = DoubleArray(n)
    for (i in 0 until n) {
      lats[i] = pts[i].latitude
      lngs[i] = pts[i].longitude
    }
    cum[0] = 0.0
    for (i in 1 until n) {
      cum[i] = cum[i - 1] + SphericalUtil.computeDistanceBetween(pts[i - 1], pts[i])
      bearings[i - 1] = normalizeHeading(SphericalUtil.computeHeading(pts[i - 1], pts[i]))
    }
    // Repeat the last segment bearing so bearings[n-1] is always defined.
    bearings[n - 1] = bearings[n - 2]

    points = pts
    cumDist = cum
    return NativeRouteTable(lats, lngs, cum, bearings, cum[n - 1])
  }

  override fun projectOnPath(
    lat: Double,
    lng: Double,
    startIdx: Double,
    endIdx: Double,
  ): NativePathProjection {
    val pts = points
    check(pts.size >= 2) { "projectOnPath called before prepareRoute" }

    val lastSegment = pts.size - 2
    val s0 = startIdx.toInt().coerceIn(0, lastSegment)
    val s1 = endIdx.toInt().coerceIn(s0, lastSegment)
    val p = LatLng(lat, lng)

    var bestDist = Double.MAX_VALUE
    var bestSegment = s0
    var bestT = 0.0
    for (i in s0..s1) {
      val a = pts[i]
      val b = pts[i + 1]
      val dist = PolyUtil.distanceToLine(p, a, b)
      if (dist < bestDist) {
        bestDist = dist
        bestSegment = i
        bestT = fractionAlongSegment(p, a, b)
      }
    }

    val segLen = cumDist[bestSegment + 1] - cumDist[bestSegment]
    return NativePathProjection(
      cumDist[bestSegment] + segLen * bestT,
      bestDist,
      bestSegment.toDouble(),
    )
  }

  /**
   * Fraction [0, 1] of the nearest point on segment a→b, using the same
   * planar approximation PolyUtil.distanceToLine uses internally (it does
   * not expose the fraction).
   */
  private fun fractionAlongSegment(p: LatLng, a: LatLng, b: LatLng): Double {
    val dLat = b.latitude - a.latitude
    val dLng = b.longitude - a.longitude
    val lenSq = dLat * dLat + dLng * dLng
    if (lenSq == 0.0) return 0.0
    val u = ((p.latitude - a.latitude) * dLat + (p.longitude - a.longitude) * dLng) / lenSq
    return u.coerceIn(0.0, 1.0)
  }

  /** SphericalUtil.computeHeading returns [-180, 180]; table uses [0, 360). */
  private fun normalizeHeading(degrees: Double): Double {
    val normalized = degrees % 360.0
    return if (normalized < 0) normalized + 360.0 else normalized
  }
}
