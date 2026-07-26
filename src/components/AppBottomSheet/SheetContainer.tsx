import {
  ModalBottomSheet,
  programmatic,
  type Detent,
} from "@swmansion/react-native-bottom-sheet";
import React, { type ReactNode, useEffect, useMemo, useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { SheetSurfaceBackground, SheetSurfaceContent } from "./SheetSurface";
import { type SheetEntry } from "./registry";
import { type AppDetent, type BottomSheetOptions } from "./types";
import { sheetRegistry } from "./useAppBottomSheet";

const DEFAULT_SCRIM_OPACITY = 0.5;

export const SheetContainer = ({
  entry,
  isTop,
}: {
  entry: SheetEntry<ReactNode>;
  isTop: boolean;
}) => {
  const options = entry.extra as BottomSheetOptions;
  const { id } = entry;
  const dismissible = entry.options.dismissible;
  const contentRef = useRef<View>(null);

  // Detents and opacities are memoized on serialized keys so fresh but equal
  // arrays from callers don't churn the native props.
  const detentsKey = JSON.stringify(options.detents ?? ["content"]);
  const opacityKey = JSON.stringify(
    options.backdrop?.opacity ?? DEFAULT_SCRIM_OPACITY,
  );

  const detents = useMemo<Detent[]>(() => {
    const publicDetents = JSON.parse(detentsKey) as AppDetent[];
    return [dismissible ? 0 : programmatic(0), ...publicDetents];
  }, [dismissible, detentsKey]);

  const scrimOpacities = useMemo(() => {
    const opacity = JSON.parse(opacityKey) as number | number[];
    const perDetent = Array.isArray(opacity)
      ? opacity
      : (JSON.parse(detentsKey) as unknown[]).map(() => opacity);
    return [0, ...perDetent];
  }, [opacityKey, detentsKey]);

  // Move screen-reader focus into the sheet once it is up.
  useEffect(() => {
    const timer = setTimeout(() => {
      const node = contentRef.current && findNodeHandle(contentRef.current);
      if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  const { onDetentChange } = options;
  useEffect(() => {
    if (!onDetentChange) return;
    return sheetRegistry.onUserDetentChange((sheetId, publicIndex) => {
      if (sheetId === id) onDetentChange(publicIndex);
    });
  }, [id, onDetentChange]);

  const { onPositionChange } = options;
  const tapToDismiss =
    dismissible &&
    (options.backdrop?.tapToDismiss ?? true) &&
    isTop &&
    entry.status !== "dismissing";

  return (
    <>
      {/*
        Defensive only: on-device testing showed the library's native scrim
        already consumes backdrop taps and snaps to the closed detent itself
        (reported to us as reason "drag" via onIndexChange, not "backdrop").
        This Pressable sits behind that native overlay and currently never
        receives the touch, but is kept in case that changes on some
        OEM/Android version. See README "Library gaps".
      */}
      {tapToDismiss && (
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => sheetRegistry.requestDismiss(id, "backdrop")}
        />
      )}
      <ModalBottomSheet
        detents={detents}
        index={entry.index}
        animateIn
        nativeOverlay={options.nativeOverlay}
        // The library's own keyboard-handling recipe requires this: without
        // it, the sheet's own resize spring fights the keyboard-driven
        // padding change in SheetSurfaceContent. Caller can still override.
        animateContentHeight={
          options.animateContentHeight ??
          (options.keyboard === "avoid" ? false : undefined)
        }
        extendUnderStatusBar={options.extendUnderStatusBar}
        scrimColor={options.backdrop?.color ?? "black"}
        scrimOpacities={scrimOpacities}
        scrollableNegotiation={options.scrollableNegotiation}
        onIndexChange={(i) => sheetRegistry.noteUserSnapStart(id, i)}
        onSettle={(i) => sheetRegistry.noteSettle(id, i)}
        onPositionChange={
          onPositionChange
            ? (event) =>
                onPositionChange({
                  position: event.nativeEvent.position,
                  index: event.nativeEvent.index - 1,
                })
            : undefined
        }
        surface={
          <SheetSurfaceBackground
            backgroundColor={options.surface?.backgroundColor}
            borderTopRadius={options.surface?.borderTopRadius}
          />
        }
      >
        <SheetSurfaceContent ref={contentRef} options={options}>
          {entry.content}
        </SheetSurfaceContent>
      </ModalBottomSheet>
    </>
  );
};
