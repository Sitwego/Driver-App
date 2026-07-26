# AppBottomSheet

Composable modal bottom-sheet system built on
[`@swmansion/react-native-bottom-sheet`](https://github.com/software-mansion-labs/react-native-bottom-sheet)
(v0.17.0-next.1, native/Fabric, New Architecture required). Any component can
open a sheet imperatively with zero local plumbing; a declarative wrapper
exists for screen-local sheets. Both share one themed surface (background,
top radius, drag handle, safe-area padding, optional keyboard avoidance).

`AppBottomSheetProvider` is mounted once in `src/App.tsx` (inside
`GestureHandlerRootView`). Feature code imports only from
`~/components/AppBottomSheet`:

- `useAppBottomSheet()` → `{ present, update, dismiss, dismissAll }`
- `<AppBottomSheet open onDismiss>` — declarative escape hatch
- Public types (`BottomSheetOptions`, `DismissReason`, …)

> Naming: the hook is `useAppBottomSheet` (not `useBottomSheet`) to avoid
> colliding with the older TrueSheet-based hook in `~/components/RnBottomSheet`.

## Detents

Public `detents` contain only **open** positions — `number` (points) or
`"content"` (auto-size to content). Default is `["content"]`. The closed
position is managed internally; `initialIndex`/`index` are zero-based into
your `detents` array. With `dismissible: false` the close position becomes
unreachable by drag, and backdrop tap / back button are refused (programmatic
dismissal still works).

## Keyboard avoidance

Pass `keyboard: "avoid"` for sheets with a focusable `TextInput`. Do **not**
use `KeyboardAvoidingView` — it fights the sheet's own content-height
measurement and leaves the sheet's content invisible behind the keyboard on
Android (verified broken, see the library's [keyboard-handling
docs](https://software-mansion-labs.github.io/react-native-bottom-sheet/keyboard-handling)
and its `KeyboardContentDetentScreen` example). Instead, when
`keyboard: "avoid"` is set:

- `SheetContainer` passes `animateContentHeight={false}` to `ModalBottomSheet`
  (unless you explicitly set `animateContentHeight` yourself), so the sheet
  follows the content's height directly instead of running its own resize
  spring on top of the keyboard-driven change.
- `SheetSurfaceContent` drives the content's bottom padding with
  `react-native-keyboard-controller`'s `useReanimatedKeyboardAnimation()`
  (a UI-thread Reanimated value), not `KeyboardAvoidingView`:
  `paddingBottom = max(safeAreaBottomPadding, max(0, -keyboardHeight.value))`.
  For a `'content'`-only detent this grows the measured content height as the
  keyboard rises, so the sheet expands to keep the input visible; the padding
  — and the sheet — shrink back once the keyboard closes.

Verified on-device: the input stays visible and typable while the keyboard is
open, and the sheet returns to its normal content-sized height once the
keyboard is dismissed.

## Examples

### 1. Imperative confirmation sheet (content-sized)

```tsx
import { useAppBottomSheet } from "~/components/AppBottomSheet";

const DeleteButton = () => {
  const sheets = useAppBottomSheet();
  const confirm = () => {
    const id = sheets.present(
      <ConfirmDelete
        onConfirm={() => {
          doDelete();
          sheets.dismiss(id);
        }}
        onCancel={() => sheets.dismiss(id)}
      />,
      {
        detents: ["content"],
        onDismiss: (reason) => console.log("closed via", reason),
      },
    );
  };
  return <Button title="Delete…" onPress={confirm} />;
};
```

`onDismiss` fires exactly once per sheet, on every path: drag-down,
backdrop tap, Android back button, navigation change, or programmatic
`dismiss()`.

### 2. Declarative screen-local sheet with a scrollable list (fixed detents)

Plain RN scrollables work inside the sheet — no wrapper list components.
The caller **must** reset `open` in `onDismiss`, because the sheet can close
on its own (drag, back button, …).

```tsx
import { AppBottomSheet } from "~/components/AppBottomSheet";

const StopsScreen = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button title="Pick a stop" onPress={() => setOpen(true)} />
      <AppBottomSheet
        open={open}
        onDismiss={() => setOpen(false)}
        detents={[320, 600]}
      >
        <FlatList data={stops} renderItem={renderStop} />
      </AppBottomSheet>
    </>
  );
};
```

### 3. Stacked sheet (sheet over sheet)

Present from inside a sheet's content; the back button and `dismiss()` pop
the top sheet first, and scrims layer per sheet.

```tsx
const DetailsContent = () => {
  const sheets = useAppBottomSheet();
  return (
    <Button
      title="Remove stop"
      onPress={() =>
        sheets.present(<ConfirmRemove />, { detents: ["content"] })
      }
    />
  );
};
```

### 4. Content-sized vs fixed detents, programmatic snap

```tsx
// Auto-sized to whatever the content measures (clamped to the screen):
sheets.present(<QuickInfo />, { detents: ["content"] });

// Half-open then full, starting half-open; snap to full later:
const id = sheets.present(<RouteOverview />, {
  detents: [360, 720],
  initialIndex: 0,
  onDetentChange: (i) => console.log("user snapped to", i),
});
sheets.update(id, { index: 1 }); // programmatic snap — no onDetentChange
```

### Options quick reference

| Option | Default | Notes |
| --- | --- | --- |
| `detents` | `["content"]` | open positions only, ascending |
| `initialIndex` | `0` | into `detents` |
| `dismissible` | `true` | `false` blocks drag/backdrop/back |
| `backdrop` | `{ color: "black", opacity: 0.5, tapToDismiss: true }` | `opacity` may be per-detent array |
| `surface` | theme background, `borderRadius.lg`, handle shown | `contentContainerStyle` for padding |
| `keyboard` | `"none"` | `"avoid"` pads content by the live keyboard height (see "Keyboard avoidance" below); forces `animateContentHeight: false` unless you set it explicitly |
| `safeArea` | `{ bottom: true, top: false }` | bottom inset padding |
| `dismissOnNavigate` | `true` | auto-dismiss on route change |

## Architecture notes

- `registry.ts` is a pure TypeScript state machine (no React imports) holding
  the sheet stack; it is unit-tested under the node-only jest config
  (`__tests__/registry.test.ts`). The React layer is a thin shell:
  `BottomSheetHost` renders one `ModalBottomSheet` per entry via
  `useSyncExternalStore`.
- The library is fully controlled (`index` prop, no imperative API); closing
  means snapping to the internal 0-detent. Dismissal is finalized on
  `onSettle(0)`, with a 1 s watchdog so `onDismiss` fires even if the settle
  event is lost.
- Android back: a `BackHandler` listener is registered only while a sheet is
  open (so it wins LIFO ordering) and is consumed whenever any sheet is up —
  including non-dismissible ones.
- Accessibility: while a sheet is open the app subtree gets
  `importantForAccessibility="no-hide-descendants"` (Android's equivalent of
  `accessibilityViewIsModal`), and screen-reader focus is moved into the
  sheet content on present.

## Library gaps / workarounds (pre-1.0)

All items below were verified on-device (Android, `0.17.0-next.1`, New Arch).

- **No `onDismiss`/`dismissible` props** — modeled on top of the controlled
  `index` + `onIndexChange` (user snap start) + `onSettle` (any snap end),
  plus `programmatic(0)` to make the close detent undraggable. Confirmed
  working for drag, backdrop, back button, `dismissAll`, and stacking.
- **Backdrop tap already works — no workaround needed.** On-device testing
  showed the native scrim itself consumes the tap and snaps to the closed
  detent (reported to us as reason `"drag"` via `onIndexChange`, not
  `"backdrop"` — the library doesn't distinguish the two). Our own
  `Pressable` backdrop layer in `SheetContainer.tsx` sits behind that native
  overlay and never receives the touch on this device; it's kept as a
  harmless defensive fallback only.
  - **Consequence:** `backdrop.tapToDismiss` cannot currently be set
    independently of `dismissible` — both drag-to-close and tap-to-close
    share the same native detent-reachability mechanism. Setting
    `dismissible: true, backdrop: { tapToDismiss: false }` will **not**
    actually block backdrop-tap dismissal today.
- **`'content'` detent vs. full-height content — `flex: 1` must be applied
  conditionally, not unconditionally.** The library's own guidance ("apply
  `flex: 1` to the content for a full-height sheet") is correct but
  dangerous if applied to every sheet: giving the shared surface wrapper
  `flex: 1` unconditionally made **content-sized sheets expand to fill the
  full screen** instead of hugging their content (verified as a real
  regression, then fixed). `SheetSurfaceContent` now applies `flex: 1` only
  when `detents` contains a non-`"content"` value (see `wantsBoundedHeight`
  in `SheetSurface.tsx`). Full-height windows (e.g. a detent equal to
  screen height, with `extendUnderStatusBar` + `safeArea.top`) were verified
  working after this fix.
- **Keyboard avoidance: `KeyboardAvoidingView` does not work with this
  library — resolved with the library's own recipe instead.** The first
  implementation wrapped content in `react-native-keyboard-controller`'s
  `KeyboardAvoidingView` (`padding` and `height` behaviors both tried) and
  the sheet's content became fully invisible behind the keyboard on Android
  in every case — confirmed independent of rendering mode (default portal
  and `nativeOverlay` both failed identically). The fix, found in the
  library's own docs/examples (`KeyboardContentDetentScreen`), is to *not*
  use `KeyboardAvoidingView` at all: set `animateContentHeight={false}` and
  drive the content's `paddingBottom` directly from
  `useReanimatedKeyboardAnimation()`. See "Keyboard avoidance" above for the
  full recipe and rationale — this is what `keyboard: "avoid"` now does.
- **`nativeOverlay` was evaluated separately and rejected — it regresses the
  Android back button.** While investigating the keyboard issue,
  `nativeOverlay` was tried as an alternative rendering mode. It did not fix
  the keyboard problem (same failure as the portal, before the fix above was
  found) and separately, a single back press while a sheet was open exited
  the whole app to the home screen instead of dismissing the sheet (observed
  with a two-sheet stack: the top sheet's own native window appears to
  consume/mishandle the back press outside of React Native's JS-level
  `BackHandler` dispatch chain, rather than routing through our
  `handleBack()` logic). `nativeOverlay` is **not used** by this module —
  sheets render through the default `BottomSheetProvider` portal, where
  back-button handling is verified working (see "Verified on-device" below).
  Revisit `nativeOverlay` only alongside a from-scratch back-button
  regression test if a future library version changes this behavior.
- **No handle/a11y props** — handle drawn, a11y wired, in `SheetSurface.tsx`.
- Requires a native build (Expo dev-client / prebuild); does not run in
  Expo Go.

### Verified on-device (Android)

Animate-in from closed; drag-to-close; backdrop-tap-to-close;
`dismissible: false` blocks drag/tap/back but not programmatic/`dismissAll`;
Android back dismisses top-of-stack only and is consumed even for
non-dismissible sheets; stacked sheets with compounding scrim; `'content'`
auto-sizing; fixed detents `[320, 640]` with `scrollableNegotiation`
handoff-then-scroll (plain `FlatList` scrolls correctly once at the max
detent); full-height window sheet with `extendUnderStatusBar` +
`safeArea.top`; `onPositionChange` fractional position/index events;
navigation-triggered `dismissAll` respecting `dismissOnNavigate: false`;
keyboard avoidance for a `TextInput` inside a `'content'`-detent sheet
(input stays visible and typable while the keyboard is open, sheet returns
to its normal height once dismissed — see "Keyboard avoidance" above).
