import { useEffect } from "react";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { type NavigationProps } from "~/navigation/types";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

export const RideScreen: React.FC<NavigationProps<"RideScreen">> = ({
  navigation,
}) => {
  const { colors } = useAppTheme();
  useEffect(() => {
    const unsubscribe = navigation.addListener("transitionEnd", () => {
      console.log("RideScreen transitionEnd");
      // Close bottomsheet modal to give RideScreen more space after the transition ends
    });
    return unsubscribe;
  }, [navigation]);
  return (
    <RnView>
      <RnText>RideScreen</RnText>
    </RnView>
  );
};
