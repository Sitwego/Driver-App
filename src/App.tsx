import { ReanimatedTrueSheetProvider } from "@lodev09/react-native-true-sheet/reanimated";
import { useEffect } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureDetectorProvider } from "react-native-screens/gesture-handler";

import { OfflineIndicator } from "./components/OfflineIndicator";
import { ToastComponent } from "./components/Toast";
import RootRouter from "./components/router/router";
import { useInAppUpdates } from "./hooks/useInAppUpdates";
import { useNotificationHandler } from "./hooks/useNotificationHandler";
import { DriverSettingsProvider } from "./lib/Providers/DriverSettingsProvider";
import { LocationGateProvider } from "./lib/Providers/LocationGateProvider";
import { LoggedOutProvider } from "./lib/Providers/LoggedoutProvider";
import { Provider as DefaultPortal } from "./lib/Providers/Portal";
import { RemoteConfigProvider } from "./lib/Providers/RemoteConfigProvider";
import { UseRideRequestProvider } from "./lib/Providers/UseRideRequestProvider";
import { saveTokenToSharedPreferences } from "./lib/native";
import { NetworkQueryProvider } from "./lib/net";
import netInfo from "./lib/net/netInfo";
import { UserStateProvider, useUserState } from "./lib/state/userState";
import { ThemeProvider } from "./ui/theme/ThemeProvider";

const InnerApp = () => {
  const state = useUserState();
  const { updateCancelled, retryUpdate } = useInAppUpdates();
  useNotificationHandler();
  useEffect(() => {
    (async function (token) {
      if (token) {
        console.log(token);
        await saveTokenToSharedPreferences(token);
      }
    })(state.token || "");
    const unsubscribeNetInfo = netInfo.subscribeToNetInfo(state.token);
    return () => {
      unsubscribeNetInfo();
    };
  }, [state.token]);

  if (updateCancelled) {
    return (
      <View style={styles.blocker}>
        <Text style={styles.blockerTitle}>Update Required</Text>
        <Text style={styles.blockerMessage}>
          A critical update is required to continue using the app. Please update
          to the latest version to access new features and fixes.
        </Text>
        <Button title="Update Now" onPress={retryUpdate} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.container]}>
      <GestureDetectorProvider>
        <LocationGateProvider enabled={!!state.token}>
          <RootRouter />
          <ToastComponent />
          <OfflineIndicator />
        </LocationGateProvider>
      </GestureDetectorProvider>
    </GestureHandlerRootView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <RemoteConfigProvider>
        <ThemeProvider themeMode={"dark"}>
          <KeyboardProvider>
            <DefaultPortal>
              <NetworkQueryProvider>
                <UserStateProvider>
                  <LoggedOutProvider>
                    <ReanimatedTrueSheetProvider>
                      <DriverSettingsProvider>
                        <UseRideRequestProvider>
                          <InnerApp />
                        </UseRideRequestProvider>
                      </DriverSettingsProvider>
                    </ReanimatedTrueSheetProvider>
                  </LoggedOutProvider>
                </UserStateProvider>
              </NetworkQueryProvider>
            </DefaultPortal>
          </KeyboardProvider>
        </ThemeProvider>
      </RemoteConfigProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blocker: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  blockerTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  blockerMessage: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
  },
});
