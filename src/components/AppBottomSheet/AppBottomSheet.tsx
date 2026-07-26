import { useCallback, useEffect, useRef, useState } from "react";

import {
  type AppBottomSheetProps,
  type BottomSheetOptions,
  type DismissReason,
  type SheetId,
} from "./types";
import { useAppBottomSheet } from "./useAppBottomSheet";

/**
 * Declarative escape hatch over the imperative registry: co-locate a sheet
 * with a screen and drive it with `open`. The caller MUST reset `open` to
 * false inside `onDismiss` — the sheet can close on its own (drag, backdrop,
 * back button, navigation) and `open` has to follow.
 */
export const AppBottomSheet = ({
  open,
  onDismiss,
  index,
  children,
  ...options
}: AppBottomSheetProps) => {
  const sheets = useAppBottomSheet();
  const idRef = useRef<SheetId | null>(null);
  // Bumped when a sheet finishes dismissing so an already-true `open` can
  // re-present after the previous instance is fully gone.
  const [, setGeneration] = useState(0);

  const onDismissRef = useRef(onDismiss);
  const optionsRef = useRef<Omit<BottomSheetOptions, "onDismiss">>(options);
  useEffect(() => {
    onDismissRef.current = onDismiss;
    optionsRef.current = options;
  });

  const handleDismissed = useCallback((reason: DismissReason) => {
    idRef.current = null;
    setGeneration((n) => n + 1);
    onDismissRef.current(reason);
  }, []);

  useEffect(() => {
    if (open && idRef.current === null) {
      idRef.current = sheets.present(children, {
        ...optionsRef.current,
        initialIndex: index,
        onDismiss: handleDismissed,
      });
    } else if (!open && idRef.current !== null) {
      sheets.dismiss(idRef.current);
    }
  });

  // Keep live content and options in sync while open.
  useEffect(() => {
    if (open && idRef.current !== null) {
      sheets.update(idRef.current, { content: children, options });
    }
  });

  useEffect(() => {
    if (index !== undefined && idRef.current !== null) {
      sheets.update(idRef.current, { index });
    }
  }, [index, sheets]);

  // Unmounting the owner closes the sheet; the host finishes the animation.
  useEffect(
    () => () => {
      if (idRef.current !== null) sheets.dismiss(idRef.current);
    },
    [sheets],
  );

  return null;
};
