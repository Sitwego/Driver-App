import { describe, expect, it, jest } from "@jest/globals";

import {
  createSheetRegistry,
  toInternalIndex,
  toPublicIndex,
  type RegistryEntryOptions,
  type SheetRegistry,
} from "../registry";

import type { DismissReason } from "../types";

const OPTS: RegistryEntryOptions = {
  dismissible: true,
  dismissOnNavigate: true,
};

type Registry = SheetRegistry<string>;

const present = (
  registry: Registry,
  options: Partial<RegistryEntryOptions> = {},
  onDismissed: (reason: DismissReason) => void = () => {},
  initialInternalIndex = 1,
) =>
  registry.present(
    "content",
    { ...OPTS, ...options },
    null,
    initialInternalIndex,
    onDismissed,
  );

describe("index mapping", () => {
  it("round-trips public and internal indices", () => {
    expect(toInternalIndex(0)).toBe(1);
    expect(toInternalIndex(2)).toBe(3);
    expect(toPublicIndex(toInternalIndex(5))).toBe(5);
    expect(toPublicIndex(1)).toBe(0);
  });
});

describe("present", () => {
  it("returns unique ids and stacks in call order", () => {
    const registry = createSheetRegistry<string>();
    const a = present(registry);
    const b = present(registry);
    expect(a).not.toBe(b);
    expect(registry.getStack().map((e) => e.id)).toEqual([a, b]);
  });

  it("starts entries as presenting with the given internal index", () => {
    const registry = createSheetRegistry<string>();
    present(registry, {}, () => {}, 2);
    const [entry] = registry.getStack();
    expect(entry.status).toBe("presenting");
    expect(entry.index).toBe(2);
  });

  it("clamps the initial internal index to at least 1 (never mounts closed)", () => {
    const registry = createSheetRegistry<string>();
    present(registry, {}, () => {}, 0);
    expect(registry.getStack()[0].index).toBe(1);
  });

  it("settling at an open detent moves presenting -> open", () => {
    const registry = createSheetRegistry<string>();
    const id = present(registry);
    registry.noteSettle(id, 1);
    expect(registry.getStack()[0].status).toBe("open");
  });
});

describe("programmatic dismissal", () => {
  it("requestDismiss marks dismissing at index 0, settle finalizes once", () => {
    const registry = createSheetRegistry<string>();
    const onDismissed = jest.fn();
    const id = present(registry, {}, onDismissed);
    registry.noteSettle(id, 1);

    expect(registry.requestDismiss(id, "programmatic")).toBe(true);
    const [entry] = registry.getStack();
    expect(entry.status).toBe("dismissing");
    expect(entry.index).toBe(0);
    expect(onDismissed).not.toHaveBeenCalled();

    registry.noteSettle(id, 0);
    expect(registry.getStack()).toHaveLength(0);
    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(onDismissed).toHaveBeenCalledWith("programmatic");
  });

  it("is idempotent: repeat dismiss/settle calls fire the callback once", () => {
    const registry = createSheetRegistry<string>();
    const onDismissed = jest.fn();
    const id = present(registry, {}, onDismissed);

    expect(registry.requestDismiss(id, "programmatic")).toBe(true);
    expect(registry.requestDismiss(id, "backdrop")).toBe(false);
    registry.noteSettle(id, 0);
    registry.noteSettle(id, 0);
    expect(registry.requestDismiss(id, "programmatic")).toBe(false);
    registry.forceRemove(id, "unmount");

    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(onDismissed).toHaveBeenCalledWith("programmatic");
  });

  it("dismiss with no id targets the top sheet", () => {
    const registry = createSheetRegistry<string>();
    const a = present(registry);
    const b = present(registry);
    registry.requestDismiss(undefined, "programmatic");
    const stack = registry.getStack();
    expect(stack.find((e) => e.id === a)?.status).toBe("presenting");
    expect(stack.find((e) => e.id === b)?.status).toBe("dismissing");
  });
});

describe("drag dismissal", () => {
  it("user snap-start to 0 dismisses with reason drag", () => {
    const registry = createSheetRegistry<string>();
    const onDismissed = jest.fn();
    const id = present(registry, {}, onDismissed);
    registry.noteSettle(id, 1);

    registry.noteUserSnapStart(id, 0);
    expect(registry.getStack()[0].status).toBe("dismissing");
    registry.noteSettle(id, 0);
    expect(onDismissed).toHaveBeenCalledWith("drag");
  });

  it("settle at 0 without a tracked dismissal finalizes as drag (race)", () => {
    const registry = createSheetRegistry<string>();
    const onDismissed = jest.fn();
    const id = present(registry, {}, onDismissed);
    registry.noteSettle(id, 1);

    registry.noteSettle(id, 0);
    expect(registry.getStack()).toHaveLength(0);
    expect(onDismissed).toHaveBeenCalledWith("drag");
  });

  it("drag-to-close is ignored for non-dismissible sheets", () => {
    const registry = createSheetRegistry<string>();
    const id = present(registry, { dismissible: false });
    registry.noteUserSnapStart(id, 0);
    expect(registry.getStack()[0].status).toBe("presenting");
  });
});

describe("detent changes", () => {
  it("user snaps to open detents update index and emit the public index", () => {
    const registry = createSheetRegistry<string>();
    const onDetent = jest.fn();
    const id = present(registry);
    registry.onUserDetentChange(onDetent);
    registry.noteSettle(id, 1);

    registry.noteUserSnapStart(id, 2);
    expect(registry.getStack()[0].index).toBe(2);
    expect(onDetent).toHaveBeenCalledWith(id, 1);
  });

  it("programmatic index update does not emit a user detent change", () => {
    const registry = createSheetRegistry<string>();
    const onDetent = jest.fn();
    const id = present(registry);
    registry.onUserDetentChange(onDetent);

    registry.update(id, { internalIndex: 2 });
    expect(registry.getStack()[0].index).toBe(2);
    expect(onDetent).not.toHaveBeenCalled();
  });

  it("settle at an open detent while dismissing keeps the closed index", () => {
    const registry = createSheetRegistry<string>();
    const id = present(registry);
    registry.requestDismiss(id, "programmatic");
    registry.noteSettle(id, 1);
    expect(registry.getStack()[0].index).toBe(0);
    expect(registry.getStack()[0].status).toBe("dismissing");
  });
});

describe("dismissAll", () => {
  it("dismisses every sheet; each finalizes on its own settle", () => {
    const registry = createSheetRegistry<string>();
    const reasons: DismissReason[] = [];
    const a = present(registry, {}, (r) => reasons.push(r));
    const b = present(registry, {}, (r) => reasons.push(r));

    registry.dismissAll("programmatic");
    expect(registry.getStack().every((e) => e.status === "dismissing")).toBe(
      true,
    );

    registry.noteSettle(b, 0);
    expect(registry.getStack()).toHaveLength(1);
    registry.noteSettle(a, 0);
    expect(registry.getStack()).toHaveLength(0);
    expect(reasons).toEqual(["programmatic", "programmatic"]);
  });

  it("bypasses dismissible:false for programmatic reasons", () => {
    const registry = createSheetRegistry<string>();
    present(registry, { dismissible: false });
    registry.dismissAll("programmatic");
    expect(registry.getStack()[0].status).toBe("dismissing");
  });

  it("navigation dismissal respects a dismissOnNavigate filter", () => {
    const registry = createSheetRegistry<string>();
    const keep = present(registry, { dismissOnNavigate: false });
    const drop = present(registry);

    registry.dismissAll("navigation", (e) => e.options.dismissOnNavigate);
    const stack = registry.getStack();
    expect(stack.find((e) => e.id === keep)?.status).toBe("presenting");
    expect(stack.find((e) => e.id === drop)?.status).toBe("dismissing");
  });
});

describe("handleBack", () => {
  it("returns false when no sheet is open", () => {
    const registry = createSheetRegistry<string>();
    expect(registry.handleBack()).toBe(false);
  });

  it("consumes back and dismisses only the top sheet", () => {
    const registry = createSheetRegistry<string>();
    const bottom = present(registry);
    const top = present(registry);
    expect(registry.handleBack()).toBe(true);
    const stack = registry.getStack();
    expect(stack.find((e) => e.id === top)?.status).toBe("dismissing");
    expect(stack.find((e) => e.id === top)?.pendingReason).toBe("back");
    expect(stack.find((e) => e.id === bottom)?.status).toBe("presenting");
  });

  it("consumes back for a non-dismissible top sheet without dismissing it", () => {
    const registry = createSheetRegistry<string>();
    present(registry, { dismissible: false });
    expect(registry.handleBack()).toBe(true);
    expect(registry.getStack()[0].status).toBe("presenting");
  });
});

describe("dismissible: false refusal matrix", () => {
  it.each<[DismissReason, boolean]>([
    ["back", false],
    ["backdrop", false],
    ["programmatic", true],
    ["navigation", true],
  ])("reason %s => allowed: %s", (reason, allowed) => {
    const registry = createSheetRegistry<string>();
    const id = present(registry, { dismissible: false });
    expect(registry.requestDismiss(id, reason)).toBe(allowed);
  });
});

describe("update", () => {
  it("merges content and options and bumps version", () => {
    const registry = createSheetRegistry<string>();
    const id = present(registry);
    const before = registry.getStack()[0].version;

    registry.update(id, {
      content: "next",
      options: { dismissible: false },
    });
    const [entry] = registry.getStack();
    expect(entry.content).toBe("next");
    expect(entry.options).toEqual({
      dismissible: false,
      dismissOnNavigate: true,
    });
    expect(entry.version).toBe(before + 1);
  });

  it("returns false for unknown ids", () => {
    const registry = createSheetRegistry<string>();
    expect(registry.update("sheet-999", { content: "x" })).toBe(false);
  });

  it("ignores index changes while dismissing", () => {
    const registry = createSheetRegistry<string>();
    const id = present(registry);
    registry.requestDismiss(id, "programmatic");
    registry.update(id, { internalIndex: 2 });
    expect(registry.getStack()[0].index).toBe(0);
  });
});

describe("forceRemove", () => {
  it("finalizes with the given reason exactly once", () => {
    const registry = createSheetRegistry<string>();
    const onDismissed = jest.fn();
    const id = present(registry, {}, onDismissed);

    registry.forceRemove(id, "unmount");
    registry.forceRemove(id, "programmatic");
    expect(registry.getStack()).toHaveLength(0);
    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(onDismissed).toHaveBeenCalledWith("unmount");
  });
});

describe("subscribe / getStack", () => {
  it("notifies on every mutation", () => {
    const registry = createSheetRegistry<string>();
    const listener = jest.fn();
    registry.subscribe(listener);

    const id = present(registry);
    registry.update(id, { content: "x" });
    registry.requestDismiss(id, "programmatic");
    registry.noteSettle(id, 0);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("returns a stable snapshot reference between mutations", () => {
    const registry = createSheetRegistry<string>();
    const id = present(registry);
    const first = registry.getStack();
    expect(registry.getStack()).toBe(first);

    registry.update(id, { content: "x" });
    expect(registry.getStack()).not.toBe(first);
  });

  it("unsubscribe stops notifications", () => {
    const registry = createSheetRegistry<string>();
    const listener = jest.fn();
    const unsubscribe = registry.subscribe(listener);
    unsubscribe();
    present(registry);
    expect(listener).not.toHaveBeenCalled();
  });
});
