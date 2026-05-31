import React, { createContext, use, useState } from "react";
import { Alert, BackHandler } from "react-native";

import PermissionsDisclosureModal, {
  type Step,
} from "~/components/PermissionsDisclosureModal";
import {
  useLocationPermission,
  type UseLocationPermission,
} from "~/hooks/useLocationPermission";
import { LocationPermissionService } from "~/lib/location/LocationPermissionService";
import { PERMISSION_ERROR_COPY } from "~/lib/location/errors";

const LocationGateContext = createContext<UseLocationPermission | null>(null);

interface Props {
  /**
   * When false, the disclosure is never shown (state is still tracked and
   * available via context). Drive this with auth state, e.g. `isLoggedIn`.
   */
  enabled: boolean;
  children: React.ReactNode;
}

export function LocationGateProvider({ enabled, children }: Props) {
  const location = useLocationPermission();
  const {
    status,
    isLoading,
    requestForeground,
    requestBackground,
    ensureServicesEnabled,
    openAppSettings,
    openLocationSettings,
    refresh,
  } = location;

  // Hides the disclosure for the rest of the session once the flow concludes.
  const [dismissed, setDismissed] = useState(false);
  // Once-only automatic background prompt (mirrors the persisted flag).
  const [bgDisclosureShown, setBgDisclosureShown] = useState(() =>
    LocationPermissionService.hasShownBackgroundDisclosure(),
  );

  // --- step 1: foreground --------------------------------------------------

  const handleRequestForeground = async (): Promise<boolean> => {
    const result = await requestForeground();

    if (!result.granted) {
      if (result.code === "blocked") {
        const copy = PERMISSION_ERROR_COPY.blocked;
        Alert.alert(copy.title, copy.message, [
          { text: "Not now", style: "cancel" },
          { text: "Open settings", onPress: () => openAppSettings() },
        ]);
      } else {
        const copy = PERMISSION_ERROR_COPY.denied;
        Alert.alert(copy.title, copy.message);
      }
      return false;
    }

    // Foreground granted — ensure GPS is actually on before the background step.
    if (!result.snapshot.servicesEnabled) {
      const servicesOn = await ensureServicesEnabled();
      if (!servicesOn) {
        const copy = PERMISSION_ERROR_COPY.services_disabled;
        Alert.alert(copy.title, copy.message, [
          { text: "Not now", style: "cancel" },
          { text: "Open settings", onPress: () => openLocationSettings() },
        ]);
      }
    }

    return true;
  };

  // --- step 2: background --------------------------------------------------

  const finishBackgroundFlow = () => {
    setBgDisclosureShown(true);
    LocationPermissionService.markBackgroundDisclosureShown();
    setDismissed(true);
  };

  // Background location is mandatory for a driver — without it we can't deliver
  // ride requests while backgrounded, so declining it means the app can't
  // function. We exit rather than let the driver run without it. We deliberately
  // do NOT call finishBackgroundFlow here: the disclosure flag stays unset, so
  // the modal pops up again the next time the app is reopened.
  const exitFromBackgroundCancel = () => {
    BackHandler.exitApp();
  };

  const handleRequestBackground = async (): Promise<void> => {
    const result = await requestBackground();

    if (!result.granted && result.code === "blocked") {
      Alert.alert(
        "Allow all the time",
        "To keep receiving ride requests when the app is in the background, set location access to “Allow all the time” in Settings.",
        [
          {
            text: "Exit",
            style: "cancel",
            onPress: exitFromBackgroundCancel,
          },
          {
            text: "Open settings",
            onPress: () => {
              finishBackgroundFlow();
              openAppSettings();
            },
          },
        ],
      );
      return;
    }

    finishBackgroundFlow();
    refresh();
  };

  // --- decide whether the disclosure shows ---------------------------------

  let overlay: React.ReactNode = null;
  if (enabled && !isLoading && status) {
    const needForeground = status.foreground !== "granted";
    const needBackground =
      status.foreground === "granted" &&
      status.background !== "granted" &&
      !bgDisclosureShown;
    const visible = !dismissed && (needForeground || needBackground);

    if (visible) {
      const initialStep: Step = needForeground
        ? "permissions"
        : "background-location";
      overlay = (
        <PermissionsDisclosureModal
          visible
          initialStep={initialStep}
          onRequestForeground={handleRequestForeground}
          onRequestBackground={handleRequestBackground}
          onSkipBackground={exitFromBackgroundCancel}
        />
      );
    }
  }

  return (
    <LocationGateContext.Provider value={location}>
      {children}
      {/* Rendered AFTER children (the GestureHandlerRootView subtree) so the
          overlay sits outside the GH tree — see header note. */}
      {overlay}
    </LocationGateContext.Provider>
  );
}

/** Access the shared location-permission state/actions from any screen. */
export function useLocationGate(): UseLocationPermission {
  const ctx = use(LocationGateContext);
  if (!ctx) {
    throw new Error(
      "useLocationGate must be used within a LocationGateProvider",
    );
  }
  return ctx;
}
