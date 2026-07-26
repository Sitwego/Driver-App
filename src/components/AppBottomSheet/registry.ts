// Pure sheet-stack state machine. No react / react-native imports so it runs
// under the node-only jest config (see jest.config.js roots).
//
// Index convention: the library detent array is [close, ...publicDetents], so
// internal index 0 = closed and internal index = public index + 1. The React
// layer feeds library events in (noteUserSnapStart <- onIndexChange,
// noteSettle <- onSettle) and renders from getStack().
import type { DismissReason, SheetId } from "./types";

export type SheetStatus = "presenting" | "open" | "dismissing";

export interface RegistryEntryOptions {
  dismissible: boolean;
  dismissOnNavigate: boolean;
}

export interface SheetEntry<TContent> {
  id: SheetId;
  content: TContent;
  options: RegistryEntryOptions;
  /** Opaque options bag carried for the React layer (full BottomSheetOptions). */
  extra: unknown;
  status: SheetStatus;
  /** Internal detent index; 0 only while dismissing. */
  index: number;
  pendingReason: DismissReason | null;
  /** Bumped by update() so the React layer re-renders content. */
  version: number;
}

export interface SheetUpdatePatch<TContent> {
  content?: TContent;
  internalIndex?: number;
  options?: Partial<RegistryEntryOptions>;
  extra?: unknown;
}

export interface SheetRegistry<TContent> {
  present(
    content: TContent,
    options: RegistryEntryOptions,
    extra: unknown,
    initialInternalIndex: number,
    onDismissed: (reason: DismissReason) => void,
  ): SheetId;
  update(id: SheetId, patch: SheetUpdatePatch<TContent>): boolean;
  requestDismiss(id: SheetId | undefined, reason: DismissReason): boolean;
  dismissAll(
    reason: DismissReason,
    filter?: (entry: SheetEntry<TContent>) => boolean,
  ): void;
  /** Android back press. Returns true when consumed (any sheet open). */
  handleBack(): boolean;
  /** Library onIndexChange: a user-driven snap started. */
  noteUserSnapStart(id: SheetId, internalIndex: number): void;
  /** Library onSettle: any snap animation settled. */
  noteSettle(id: SheetId, internalIndex: number): void;
  /** Finalize without a settle (watchdog / teardown). */
  forceRemove(id: SheetId, reason: DismissReason): void;
  getStack(): readonly SheetEntry<TContent>[];
  subscribe(listener: () => void): () => void;
  onUserDetentChange(
    listener: (id: SheetId, publicIndex: number) => void,
  ): () => void;
}

export const toInternalIndex = (publicIndex: number): number => publicIndex + 1;
export const toPublicIndex = (internalIndex: number): number =>
  internalIndex - 1;

export function createSheetRegistry<TContent>(): SheetRegistry<TContent> {
  let counter = 0;
  const entries: SheetEntry<TContent>[] = [];
  const dismissCallbacks = new Map<SheetId, (reason: DismissReason) => void>();
  const listeners = new Set<() => void>();
  const detentListeners = new Set<(id: SheetId, publicIndex: number) => void>();
  let snapshot: SheetEntry<TContent>[] | null = [];

  const notify = () => {
    snapshot = null;
    for (const listener of [...listeners]) listener();
  };

  const find = (id: SheetId) => entries.find((e) => e.id === id);

  const finalize = (id: SheetId, reason: DismissReason) => {
    const at = entries.findIndex((e) => e.id === id);
    if (at < 0) return;
    entries.splice(at, 1);
    const callback = dismissCallbacks.get(id);
    dismissCallbacks.delete(id);
    notify();
    callback?.(reason);
  };

  const requestDismiss = (
    id: SheetId | undefined,
    reason: DismissReason,
  ): boolean => {
    const entry = id === undefined ? entries[entries.length - 1] : find(id);
    if (!entry || entry.status === "dismissing") return false;
    if (
      !entry.options.dismissible &&
      (reason === "back" || reason === "backdrop")
    ) {
      return false;
    }
    entry.status = "dismissing";
    entry.pendingReason = reason;
    entry.index = 0;
    notify();
    return true;
  };

  return {
    present(content, options, extra, initialInternalIndex, onDismissed) {
      const id: SheetId = `sheet-${++counter}`;
      entries.push({
        id,
        content,
        options,
        extra,
        status: "presenting",
        index: Math.max(1, initialInternalIndex),
        pendingReason: null,
        version: 0,
      });
      dismissCallbacks.set(id, onDismissed);
      notify();
      return id;
    },

    update(id, patch) {
      const entry = find(id);
      if (!entry) return false;
      if (patch.content !== undefined) entry.content = patch.content;
      if (patch.options) entry.options = { ...entry.options, ...patch.options };
      if (patch.extra !== undefined) entry.extra = patch.extra;
      if (patch.internalIndex !== undefined && entry.status !== "dismissing") {
        entry.index = Math.max(1, patch.internalIndex);
      }
      entry.version += 1;
      notify();
      return true;
    },

    requestDismiss,

    dismissAll(reason, filter) {
      for (const entry of [...entries].reverse()) {
        if (filter && !filter(entry)) continue;
        requestDismiss(entry.id, reason);
      }
    },

    handleBack() {
      const top = entries[entries.length - 1];
      if (!top) return false;
      if (top.options.dismissible) requestDismiss(top.id, "back");
      return true;
    },

    noteUserSnapStart(id, internalIndex) {
      const entry = find(id);
      if (!entry || entry.status === "dismissing") return;
      if (internalIndex === 0) {
        if (!entry.options.dismissible) return;
        entry.status = "dismissing";
        entry.pendingReason = "drag";
        entry.index = 0;
        notify();
        return;
      }
      if (entry.index !== internalIndex) {
        entry.index = internalIndex;
        notify();
        const publicIndex = toPublicIndex(internalIndex);
        for (const listener of [...detentListeners]) listener(id, publicIndex);
      }
    },

    noteSettle(id, internalIndex) {
      const entry = find(id);
      if (!entry) return;
      if (internalIndex === 0) {
        // Settling closed without a tracked dismissal means the drag committed
        // and settled before we processed the snap-start event.
        finalize(id, entry.pendingReason ?? "drag");
        return;
      }
      if (entry.status === "dismissing") {
        // Keep the controlled index at 0 — the sheet is still on its way out
        // and will settle closed on the next event.
        return;
      }
      if (entry.status === "presenting") {
        entry.status = "open";
        entry.index = internalIndex;
        notify();
      } else if (entry.index !== internalIndex) {
        entry.index = internalIndex;
        notify();
      }
    },

    forceRemove(id, reason) {
      finalize(id, reason);
    },

    getStack() {
      if (snapshot === null) snapshot = entries.map((e) => ({ ...e }));
      return snapshot;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    onUserDetentChange(listener) {
      detentListeners.add(listener);
      return () => detentListeners.delete(listener);
    },
  };
}
