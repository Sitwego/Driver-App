import React, { useEffect, useMemo } from "react";
import { BackHandler } from "react-native";

import { OnboardingControls, OnboardingLayout } from "./OnBoardingControls";
import { SubmitData } from "./Submit";
import { Docs } from "./docs";
import DocumentModalProvider from "./docs/DocumentModalProvider";
import { OnboardingControlsContext, reducer, initialState } from "./state";
import { VehicleDetails } from "./vehicleDetails";

export function DriverOnboarding() {
  const [state, dispatch] = React.useReducer(reducer, null, () => ({
    ...initialState,
  }));
  const stateCtx = useMemo(() => ({ state, dispatch }), [state]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (state.hasPrev) {
        dispatch({ type: "previous" });
        return true;
      } else {
        return false;
      }
    });
    return () => sub.remove();
  }, [state]);
  return (
    <OnboardingControls.Provider>
      <OnboardingControlsContext.Provider value={stateCtx}>
        <DocumentModalProvider>
          <OnboardingLayout>
            {state.activeStep === "vehicle_details" && <VehicleDetails />}
            {state.activeStep === "docs" && <Docs />}
            {state.activeStep === "finish" && <SubmitData />}
          </OnboardingLayout>
        </DocumentModalProvider>
      </OnboardingControlsContext.Provider>
    </OnboardingControls.Provider>
  );
}
