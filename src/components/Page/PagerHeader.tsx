import { s } from "~/styles/Common-Styles";
import { RnAnimatedView, RnView } from "../RnView";
import { Pressable } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import {
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { JSX, useCallback } from "react";
import RnText from "../RnText";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

export interface RenderTabBarFnProps {
  selectedPage: number;
  onSelect?: (index: number) => void;
  tabBarAnchor?: JSX.Element | null | undefined;
  dragProgress: SharedValue<number>;
  dragState: SharedValue<"idle" | "dragging" | "settling">;
}
export type RenderTabBarFn = (props: RenderTabBarFnProps) => JSX.Element;

const ITEM_PADDING = 10;
const CONTENT_PADDING = 6;

export type TabBarTypes = {
  items: string[];
};
export function PageTabBar({
  items,
  onSelect,
  selectedPage,
}: TabBarTypes & RenderTabBarFnProps) {
  const { colors } = useAppTheme();
  const contentSize = useSharedValue(0);
  const onTabPress = useCallback(
    (i: number) => {
      if (onSelect) {
        onSelect(i);
      }
    },
    [onSelect],
  );

  const indicatorWidth = useDerivedValue(() => {
    return contentSize.value / items.length;
  });

  const translateX = useDerivedValue(() => {
    return selectedPage * indicatorWidth.value;
  });

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(indicatorWidth.value, { duration: 300 }),
      transform: [
        { translateX: withTiming(translateX.value, { duration: 300 }) },
      ],
    };
  }, [selectedPage]);

  return (
    <RnView style={[s.flexDirectionRow]} testID="PageTabBarComponent">
      <RnView style={[styles.contentContainer]}>
        <RnAnimatedView
          onLayout={(e) => {
            contentSize.value = e.nativeEvent.layout.width;
          }}
          style={[
            s.flexDirectionRow,
            s.flexGrow1,
            { justifyContent: "space-around" },
          ]}
        >
          {items.map((v, i) => (
            <TabBarItem key={i} i={i} text={v} onPressItem={onTabPress} />
          ))}
          <RnAnimatedView
            style={[
              {
                position: "absolute",
                left: 0,
                bottom: 0,
                right: 0,
                borderBottomWidth: 2,
                borderColor: colors.primary,
              },
              indicatorStyle,
            ]}
          />
        </RnAnimatedView>
      </RnView>
    </RnView>
  );
}

const TabBarItem = ({
  i,
  onPressItem,
  text,
}: {
  i: number;
  text: string;
  onPressItem: (index: number) => void;
}) => {
  const onItemPress = useCallback(() => {
    onPressItem(i);
  }, [i, onPressItem]);

  return (
    <RnView style={{ flexGrow: 1 }}>
      <Pressable onPress={onItemPress} style={[styles.item]}>
        <RnAnimatedView style={[styles.itemInner]}>
          <RnText style={[styles.itemText]}>{text}</RnText>
        </RnAnimatedView>
      </Pressable>
    </RnView>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flexGrow: 1,
    backgroundColor: "transparent",
    paddingHorizontal: CONTENT_PADDING,
  },
  item: {
    flexGrow: 1,
    paddingTop: 10,
    paddingHorizontal: ITEM_PADDING,
    justifyContent: "center",
  },
  itemInner: {
    alignItems: "center",
    flexGrow: 1,
    paddingBottom: 10,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  itemText: {
    lineHeight: 20,
    textAlign: "center",
  },
  outerBottomBorder: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
