// Public surface of the tracking pipeline (Steps 1-3).
export * from "./types";
export {
  buildRouteTable,
  fullIndexRange,
  pointAt,
  pointAtInto,
  prepareRouteTS,
  projectOnPathTS,
  segmentIndexForDistance,
  splitRouteAt,
  windowIndexRange,
} from "./routeGeometry";
export { decodePolyline, encodePolyline } from "./polyline";
export {
  computeDistanceBetween,
  computeHeading,
  normalizeHeading,
  shortestHeadingDelta,
} from "./geo";
export { getGeometryProvider, type GeometryProvider } from "./mapsGeometry";
export {
  IngestGate,
  type AcceptedFix,
  type IngestGateOptions,
  type IngestResult,
  type RejectReason,
} from "./ingestGate";
export {
  Snapper,
  type SnapInput,
  type SnapResult,
  type SnapStatus,
  type SnapperOptions,
} from "./snap";
export {
  createMotionModel,
  motionOnFix,
  motionOnForeground,
  motionReset,
  motionTick,
  type MotionModelOptions,
  type MotionState,
} from "./motionModel";
export {
  getActiveTrackedVehicleCount,
  useTrackedVehicle,
  type PushFixOutcome,
  type TrackedVehicle,
  type TrackedVehicleUiState,
  type UseTrackedVehicleOptions,
} from "./useTrackedVehicle";
export { isSmoothTrackingEnabled } from "./flags";
export { VehicleTracker, type VehicleTrackerProps } from "./VehicleTracker";
export {
  TrackedRoutePolylines,
  VehicleMarker,
  type MarkerStrategy,
  type TrackedRoutePolylinesProps,
  type VehicleMarkerProps,
} from "./VehicleMarker";
