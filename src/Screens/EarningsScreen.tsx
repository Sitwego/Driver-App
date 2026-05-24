import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { JobHistory } from "~/ui/Views/JobHistory";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

export const EarningsScreen: React.FC<any> = ({ navigation }) => {
  const inset = useSafeAreaInsets();
  const { colors } = useAppTheme();
  return <JobHistory />;
};
