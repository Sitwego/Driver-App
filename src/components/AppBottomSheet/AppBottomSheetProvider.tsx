import { BottomSheetProvider as LibBottomSheetProvider } from "@swmansion/react-native-bottom-sheet";
import React, { PropsWithChildren, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";

import { BottomSheetHost } from "./BottomSheetHost";
import { sheetRegistry } from "./useAppBottomSheet";

const subscribe = sheetRegistry.subscribe;
const anySheetOpen = () => sheetRegistry.getStack().length > 0;

/**
 * Mount once near the app root (below SafeAreaProvider and the theme
 * provider). Hosts every sheet presented via useAppBottomSheet() or
 * <AppBottomSheet>. While a sheet is open the app subtree is hidden from
 * TalkBack — the Android equivalent of accessibilityViewIsModal.
 */
export const AppBottomSheetProvider = ({ children }: PropsWithChildren) => {
  const sheetOpen = useSyncExternalStore(subscribe, anySheetOpen);
  return (
    <LibBottomSheetProvider>
      <View
        style={styles.app}
        importantForAccessibility={sheetOpen ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      <BottomSheetHost />
    </LibBottomSheetProvider>
  );
};

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
});
