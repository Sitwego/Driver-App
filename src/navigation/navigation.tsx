import {
  createNavigationContainerRef,
  NavigationContainer,
} from "@react-navigation/native";
import React, { useMemo } from "react";

import BottomSheetProvider from "~/components/RnBottomSheet/BottomSheetProvider";
import { Provider } from "~/lib/Providers/RideReqModalProvider";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { darkTheme, lightTheme } from "~/ui/theme/theme";
import { delay } from "~/utils/await_timer";
const navigatetionRef = createNavigationContainerRef();

export const getCurrentRouteName = () => {
  if (navigatetionRef.isReady()) {
    const route = navigatetionRef.getCurrentRoute();
    return route?.name;
  }
  return null;
};

export const navigate = (name: string, params?: object) => {
  if (navigatetionRef.isReady()) {
    return Promise.race([
      new Promise<void>((resolve) => {
        const handler = () => {
          resolve();
          navigatetionRef.removeListener("state", handler);
        };
        navigatetionRef.addListener("state", handler);
        // @ts-ignore
        navigatetionRef.navigate(name, params);
      }),
      delay(1e3),
    ]);
  }
  return Promise.resolve();
};
export const RouterNavigation = ({ children }: React.PropsWithChildren) => {
  const t = useAppTheme();
  const theme = useMemo(
    () => (t.themeMode === "dark" ? darkTheme : lightTheme),
    [t],
  );
  const onready = React.useCallback(() => {
    if (navigatetionRef.isReady()) {
      console.log("Current route name:", getCurrentRouteName());
    }
  }, []);
  return (
    <NavigationContainer
      // @ts-ignore
      theme={theme}
      ref={navigatetionRef}
      onReady={onready}
    >
      <BottomSheetProvider>
        <Provider>{children}</Provider>
      </BottomSheetProvider>
    </NavigationContainer>
  );
};
