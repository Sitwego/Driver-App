import React from "react";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { createPortalGroup } from "~/lib/Providers/Portal";
import { s } from "~/styles/Common-Styles";

import { useAppTheme } from "../theme/ThemeProvider";
import { atoms } from "../theme/atoms";
import { themes } from "../theme/theme_utils";

import { useOnboardingControls } from "./state";

export const OnboardingControls = createPortalGroup();
export const OnboardingLayout: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { state, dispatch } = useOnboardingControls();
  const scrollview = React.useRef<ScrollView>(null);
  const prevActiveStep = React.useRef<string>(state.activeStep);

  React.useEffect(() => {
    if (state.activeStep !== prevActiveStep.current) {
      prevActiveStep.current = state.activeStep;
      scrollview.current?.scrollTo({ y: 0, animated: false });
    }
  }, [state]);

  return (
    <RnView
      aria-modal
      role="dialog"
      aria-role="dialog"
      aria-label="Driver Account setup"
      accessibilityLabel="Driver Account setup"
      accessibilityHint="Setup your account to be activated"
      style={[s.absolute, s.flex1, s.inset_0]}
    >
      <RnView style={[s.w100pct, s.alignCenter, s.py10]}>
        <RnView
          style={[
            s.flexDirectionRow,
            atoms.gap_sm,
            s.w100pct,
            { paddingTop: insets.top + 20, maxWidth: "60%" },
          ]}
        >
          {Array(state.totalSteps)
            .fill(0)
            .map((_, i) => (
              <RnView
                style={[
                  s.flex1,
                  atoms.rounded_full,
                  atoms.pt_xs,
                  {
                    backgroundColor:
                      i + 1 <= state.activeStepIndex
                        ? themes.green_500
                        : themes.bg_50,
                  },
                ]}
                key={i}
              />
            ))}
        </RnView>
      </RnView>
      <ScrollView
        style={[s.h100pct, s.w100pct, { paddingTop: insets.top }]}
        contentContainerStyle={{ borderWidth: 0 }}
        ref={scrollview}
      >
        <RnView
          style={[
            s.flexDirectionRow,
            s.flex1,
            s.justifyCenter,
            { paddingLeft: 20, paddingRight: 20 },
          ]}
        >
          <RnView style={[s.flex1, { maxWidth: 420 }]}>
            <RnView style={[s.flex1, s.w100pct, {}]}>{children}</RnView>
            <RnView style={{ height: 250 }} />
          </RnView>
        </RnView>
      </ScrollView>
      <OnboardingControls.Outlet />
    </RnView>
  );
};
