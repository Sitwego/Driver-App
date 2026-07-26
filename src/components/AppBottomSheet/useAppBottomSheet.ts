import { createSheetRegistry, toInternalIndex } from "./registry";

import type {
  BottomSheetController,
  BottomSheetOptions,
  SheetId,
} from "./types";
import type { ReactNode } from "react";

/**
 * Single app-wide registry instance. Module-level so the controller is
 * referentially stable and present() works even before the host mounts —
 * the host simply renders whatever the registry holds once it appears.
 */
export const sheetRegistry = createSheetRegistry<ReactNode>();

const controller: BottomSheetController = {
  present(content, options = {}) {
    return sheetRegistry.present(
      content,
      {
        dismissible: options.dismissible ?? true,
        dismissOnNavigate: options.dismissOnNavigate ?? true,
      },
      options,
      toInternalIndex(options.initialIndex ?? 0),
      options.onDismiss ?? (() => {}),
    );
  },

  update(id: SheetId, patch) {
    const entry = sheetRegistry.getStack().find((e) => e.id === id);
    if (!entry) return;
    const merged: BottomSheetOptions | undefined = patch.options
      ? { ...(entry.extra as BottomSheetOptions), ...patch.options }
      : undefined;
    sheetRegistry.update(id, {
      content: patch.content,
      internalIndex:
        patch.index !== undefined ? toInternalIndex(patch.index) : undefined,
      extra: merged,
      options: patch.options
        ? {
            ...(patch.options.dismissible !== undefined && {
              dismissible: patch.options.dismissible,
            }),
            ...(patch.options.dismissOnNavigate !== undefined && {
              dismissOnNavigate: patch.options.dismissOnNavigate,
            }),
          }
        : undefined,
    });
  },

  dismiss(id?: SheetId) {
    sheetRegistry.requestDismiss(id, "programmatic");
  },

  dismissAll() {
    sheetRegistry.dismissAll("programmatic");
  },
};

/**
 * Imperative bottom-sheet controller. The returned object is referentially
 * constant, so it is safe to use in effect/callback dependency arrays.
 *
 * ```tsx
 * const sheets = useAppBottomSheet();
 * sheets.present(<ConfirmContent />, { detents: ["content"] });
 * ```
 */
export const useAppBottomSheet = (): BottomSheetController => controller;
