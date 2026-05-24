import React, {
  ForwardedRef,
  ReactNode,
  useContext,
  useMemo,
  useRef,
} from "react";
import { useSharedValue, SharedValue } from "react-native-reanimated";

import RnBottomSheetView from "./RnBottomSheetView";

interface BottomActionSheetACT {
  show: (props: ACTBottomSheetProps) => Promise<void>;
  hide: () => Promise<void>;
}
type CMP = {
  showOtpSheet: () => void;
  endRide: () => Promise<void>;
  setArrived: () => Promise<void>;
  hasRideStarted: boolean;
};
export type ACTBottomSheetProps = {
  itemHeight?: number;
  headerHeight?: number;
  hasCancel?: boolean;
  type?: string;
  cmp?: (props: CMP) => React.ReactElement | React.ReactNode | null;
  snaps: (string | number)[];
  onClose?: () => void;
  enableContentPanningGesture?: boolean;
  hasBackDrop: boolean;
  enablePanDownToClose: boolean;
  detached?: boolean;
};

// ---------------------------------------------------------------------------
// Sheet animation context
// Exposes the TrueSheet's animated values to any component in the tree.
//   animatedIndex    — -1 (dismissed) → 0 (first detent) → 1 (fully open)
//   animatedPosition — Y of the sheet's top edge from the top of the screen
// ---------------------------------------------------------------------------
interface SheetAnimationContextValue {
  animatedIndex: SharedValue<number>;
  animatedPosition: SharedValue<number>;
}

const SheetAnimationContext =
  React.createContext<SheetAnimationContextValue | null>(null);

export const useSheetAnimation = (): SheetAnimationContextValue => {
  const ctx = useContext(SheetAnimationContext);
  if (!ctx)
    throw new Error(
      "useSheetAnimation must be used inside BottomSheetProvider",
    );
  return ctx;
};

// ---------------------------------------------------------------------------

const Context = React.createContext<BottomActionSheetACT>({
  show: async function (): Promise<void> {},
  hide: async function (): Promise<void> {},
});
const { Provider } = Context;
export const useBottomSheet = () => useContext(Context);

const BottomSheetProvider = ({ children }: { children: ReactNode }) => {
  const ref: ForwardedRef<BottomActionSheetACT> = useRef(null);

  // Shared values synced from RnBottomSheetView via props.
  // Created here so the same instances are shared across the whole tree.
  const animatedIndex = useSharedValue(-1);
  const animatedPosition = useSharedValue(0);

  const sheetAnimation = useMemo(
    () => ({ animatedIndex, animatedPosition }),
    // shared values are stable refs — memo deps are intentionally empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const getContext: BottomActionSheetACT = useMemo(
    () => ({
      show: async (options) => {
        ref.current?.show(options);
      },
      hide: async () => {
        ref.current?.hide();
      },
    }),
    [],
  );

  return (
    <SheetAnimationContext.Provider value={sheetAnimation}>
      <Provider value={getContext}>
        <RnBottomSheetView
          ref={ref}
          sheetAnimatedIndex={animatedIndex}
          sheetAnimatedPosition={animatedPosition}
        >
          {children}
        </RnBottomSheetView>
      </Provider>
    </SheetAnimationContext.Provider>
  );
};
export default BottomSheetProvider;
