import type { ScrollableNegotiation } from "@swmansion/react-native-bottom-sheet";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export type SheetId = string;

/**
 * Public detent values. The closed (0-height) detent is managed internally —
 * index 0 here is the first *open* position of the sheet.
 */
export type AppDetent = number | "content";

export type DismissReason =
  | "drag"
  | "backdrop"
  | "back"
  | "programmatic"
  | "navigation"
  | "unmount";

export interface SheetBackdropOptions {
  /** Scrim color behind the sheet. Defaults to the theme scrim (black). */
  color?: string;
  /**
   * Scrim opacity per public detent (array) or one value for all detents.
   * Defaults to 0.5.
   */
  opacity?: number | number[];
  /** Tap on the backdrop dismisses the sheet. Defaults to true. */
  tapToDismiss?: boolean;
}

export interface SheetSurfaceOptions {
  backgroundColor?: string;
  borderTopRadius?: number;
  /** Show the drag handle bar. Defaults to true. */
  showHandle?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export interface SheetSafeAreaOptions {
  /** Pad content by the top inset (full-height sheets). Defaults to false. */
  top?: boolean;
  /** Pad content by the bottom inset. Defaults to true. */
  bottom?: boolean;
}

export interface PositionInfo {
  /** Sheet position in points from the bottom of the screen. */
  position: number;
  /** Fractional public detent index (-1..detents.length-1 while closing). */
  index: number;
}

export interface BottomSheetOptions {
  /** Ascending open positions. Defaults to ["content"]. */
  detents?: AppDetent[];
  /** Initial public detent index. Defaults to 0. */
  initialIndex?: number;
  /**
   * When false the sheet cannot be closed by drag, backdrop tap, or the
   * Android back button — only programmatically. Defaults to true.
   */
  dismissible?: boolean;
  backdrop?: SheetBackdropOptions;
  surface?: SheetSurfaceOptions;
  /** "avoid" keeps focused inputs visible above the keyboard. Defaults to "none". */
  keyboard?: "none" | "avoid";
  safeArea?: SheetSafeAreaOptions;
  /** Dismiss this sheet automatically when the route changes. Defaults to true. */
  dismissOnNavigate?: boolean;
  /**
   * Render in a genuinely separate native window instead of the in-tree
   * portal. Defaults to false. Needed when the sheet must appear above
   * another native overlay system (e.g. the TrueSheet-based sheet in
   * `~/components/RnBottomSheet/RnBottomSheetView.tsx`), since a same-window
   * portal always renders below a true native Window/Dialog regardless of
   * React tree order or elevation. Opt in per-sheet, not globally: stacking
   * two `nativeOverlay` AppBottomSheet sheets was found to break the Android
   * back button (see README "Library gaps") — re-verify on-device whenever
   * a `nativeOverlay` sheet might appear alongside another open modal.
   */
  nativeOverlay?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  /** Fires exactly once per sheet, on every dismissal path. */
  onDismiss?: (reason: DismissReason) => void;
  /** Fires when the user drags/snaps to another public detent. */
  onDetentChange?: (index: number) => void;
  onPositionChange?: (info: PositionInfo) => void;
  animateContentHeight?: boolean;
  extendUnderStatusBar?: boolean;
  scrollableNegotiation?: ScrollableNegotiation;
}

export interface SheetUpdate {
  content?: ReactNode;
  /** Programmatic snap to a public detent index. */
  index?: number;
  options?: Partial<Omit<BottomSheetOptions, "initialIndex">>;
}

export interface BottomSheetController {
  present(content: ReactNode, options?: BottomSheetOptions): SheetId;
  update(id: SheetId, patch: SheetUpdate): void;
  /** Dismiss one sheet, or the top sheet when no id is given. */
  dismiss(id?: SheetId): void;
  dismissAll(): void;
}

export interface AppBottomSheetProps
  extends Omit<BottomSheetOptions, "onDismiss" | "initialIndex"> {
  open: boolean;
  /** Required — reset `open` to false here, whatever the dismissal path. */
  onDismiss: (reason: DismissReason) => void;
  /** Controlled public detent index. */
  index?: number;
  children: ReactNode;
}
