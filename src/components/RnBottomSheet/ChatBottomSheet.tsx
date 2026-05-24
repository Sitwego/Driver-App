import { forwardRef, useImperativeHandle, useRef, type Ref } from "react";
import { FlatList, StyleSheet } from "react-native";
import {
  TrueSheet,
  type TrueSheetProps,
} from "@lodev09/react-native-true-sheet";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RnView } from "../RnView";
import RnText from "../RnText";

const $content = StyleSheet.create({
  bottomSheetContainer: {
    paddingHorizontal: 10,
    overflow: "hidden",
    flexGrow: 1,
    // flexBasis: "100%",
  },
});

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Props extends TrueSheetProps {}
export const ChatBottomSheet = forwardRef(
  (props: Props, ref: Ref<TrueSheet>) => {
    const { colors, fonts } = useAppTheme();
    const flatListRef = useRef<FlatList>(null);
    const sheetRef = useRef<TrueSheet>(null);
    const inset = useSafeAreaInsets();

    useImperativeHandle<TrueSheet | null, TrueSheet | null>(
      ref,
      () => sheetRef.current,
    );
    return (
      <TrueSheet
        ref={sheetRef}
        // @ts-ignore
        scrollRef={flatListRef}
        style={{ top: inset.top }}
        contentContainerStyle={[$content.bottomSheetContainer]}
        dimmed
        sizes={["100%"]}
        blurTint="dark"
        backgroundColor={colors.background}
        keyboardMode="pan"
        edgeToEdge
        onDismiss={() => console.log("Sheet FlatList dismissed!")}
        onPresent={() => console.log(`Sheet FlatList presented!`)}
        {...props}
      >
        <RnView>
          <RnText>Chat BottomSheet Test</RnText>
        </RnView>
      </TrueSheet>
    );
  },
);

ChatBottomSheet.displayName = "ChatBottomSheet";
