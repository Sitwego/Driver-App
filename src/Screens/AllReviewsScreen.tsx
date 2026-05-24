import { View, StyleSheet } from "react-native";
import { NavigationProps } from "~/navigation/types";
import RnText from "~/components/RnText";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";

type Props = NavigationProps<"AllReviews">;

// TODO: fetch all reviews for route.params.driverId and render with LegendList
export function AllReviewsScreen(_props: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.container}>
      <RnText style={[atoms.text_md, { color: colors.text }]}>
        All reviews coming soon.
      </RnText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
