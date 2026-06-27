/* eslint-disable react/display-name */
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { BottomSheetDefaultBackdropProps } from "@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types";
import { useBackHandler } from "@react-native-community/hooks";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { JSX } from "react/jsx-runtime";
import { Keyboard, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { s } from "~/styles/Common-Styles";
import { ANIMATION_CONFIG } from "~/ui/animations";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { height } from "~/utils/metrics/dimm";

import { IABottomSheetProps } from "./DocModalType";

interface Props {
  children: React.ReactNode | React.ReactElement;
}

export default forwardRef(({ children }: Props, ref) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<IABottomSheetProps>();
  const [isVisible, setVisible] = useState(false);
  const { colors } = useAppTheme();

  const snappingPoint = useMemo(() => {
    return Math.min(
      // Items height
      (data?.itemHeight || 0) +
        // Insets bottom height (Notch devices)
        insets.bottom +
        // Cancel button height
        (data?.hasCancel ? 56 : 0),
      height,
    );
  }, [data?.hasCancel, data?.itemHeight, insets.bottom]);
  const show = useCallback(
    (props: React.SetStateAction<IABottomSheetProps | undefined>) => {
      setData(props);
      setVisible(true);
    },
    [],
  );
  const hide = useCallback(() => bottomSheetRef.current?.close(), []);

  useImperativeHandle(ref, () => ({
    show,
    hide,
  }));

  const onClose = useCallback(() => {
    setVisible((prev) => !prev);
    data?.onClose && data?.onClose();
  }, [data]);

  useBackHandler(() => {
    if (isVisible) {
      hide();
    }
    return isVisible;
  });

  useEffect(() => {
    if (isVisible) {
      Keyboard.dismiss();
    }
  }, [isVisible]);
  const renderBackdrop = useCallback(
    (props: JSX.IntrinsicAttributes & BottomSheetDefaultBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        // Backdrop should be visible all the time bottom sheet is open
        disappearsOnIndex={-1}
        opacity={1}
      />
    ),
    [],
  );
  const renderComponent = data?.children ?? null;
  // Function to handle height change in BottomSheet
  const handleSheetChange = useCallback(
    (index: number) => {
      // Snap to different index will notify this handler
      console.log(`Bottom Sheet snapped to index: ${index}`);

      index === -1 && onClose();
    },
    [onClose],
  );
  // const renderFooter = useCallback(
  //   (props: BottomSheetFooterProps) => {
  //     return (
  //       <FooterButton
  //         type={data?.type}
  //         onClose={data?.onClose}
  //         disabled={false}
  //         {...props}
  //       />
  //     );
  //   },
  //   [data?.onClose, data?.type],
  // );
  return (
    <>
      {children}
      {isVisible && (
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={data?.snaps ? data.snaps : [snappingPoint]}
          enableDynamicSizing={false}
          animationConfigs={ANIMATION_CONFIG}
          detached={data?.detached}
          animateOnMount={true}
          backdropComponent={data?.hasBackDrop ? renderBackdrop : undefined}
          handleComponent={null}
          enablePanDownToClose={data?.enablePanDownToClose}
          style={[styles.bottomSheetContainer, s.flex1, s.px10, s.py16]}
          backgroundStyle={{ backgroundColor: colors.background }}
          onChange={handleSheetChange}
          // We need this to allow horizontal swipe gesture inside the bottom sheet like in reaction picker
          enableContentPanningGesture={
            data?.enableContentPanningGesture ?? true
          }
          // footerComponent={renderFooter}
        >
          <BottomSheetView>{renderComponent}</BottomSheetView>
        </BottomSheet>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  bottomSheetContainer: {
    overflow: "hidden",
  },
});
