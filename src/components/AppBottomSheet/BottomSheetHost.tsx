import React, { useEffect, useRef, useSyncExternalStore } from "react";
import { BackHandler, StyleSheet, View } from "react-native";

import {
  addNavigationStateListener,
  getCurrentRouteName,
} from "~/navigation/navigation";

import { SheetContainer } from "./SheetContainer";
import { sheetRegistry } from "./useAppBottomSheet";

/** Grace period for a close animation before a sheet is force-finalized. */
const DISMISS_WATCHDOG_MS = 1000;

export const BottomSheetHost = () => {
  const stack = useSyncExternalStore(
    sheetRegistry.subscribe,
    sheetRegistry.getStack,
  );

  // Registered only while a sheet is open so this handler sits above any
  // screen-level handlers in BackHandler's LIFO order and wins.
  const anySheetOpen = stack.length > 0;
  useEffect(() => {
    if (!anySheetOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () =>
      sheetRegistry.handleBack(),
    );
    return () => subscription.remove();
  }, [anySheetOpen]);

  // Dismiss sheets when the route changes (unless a sheet opted out).
  const lastRoute = useRef<string | null | undefined>(undefined);
  useEffect(
    () =>
      addNavigationStateListener(() => {
        const route = getCurrentRouteName();
        if (lastRoute.current !== undefined && lastRoute.current !== route) {
          sheetRegistry.dismissAll(
            "navigation",
            (entry) => entry.options.dismissOnNavigate,
          );
        }
        lastRoute.current = route;
      }),
    [],
  );

  // A sheet stuck in "dismissing" (missed onSettle) is force-finalized so its
  // onDismiss still fires.
  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    for (const entry of stack) {
      if (entry.status === "dismissing" && !timers.has(entry.id)) {
        timers.set(
          entry.id,
          setTimeout(
            () =>
              sheetRegistry.forceRemove(
                entry.id,
                entry.pendingReason ?? "programmatic",
              ),
            DISMISS_WATCHDOG_MS,
          ),
        );
      }
    }
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, [stack]);

  // Host teardown must still deliver onDismiss for anything left open.
  useEffect(
    () => () => {
      for (const entry of sheetRegistry.getStack()) {
        sheetRegistry.forceRemove(entry.id, "unmount");
      }
    },
    [],
  );

  if (stack.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {stack.map((entry, position) => (
        <SheetContainer
          key={entry.id}
          entry={entry}
          isTop={position === stack.length - 1}
        />
      ))}
    </View>
  );
};
