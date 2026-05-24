import React, { createContext, useCallback, useContext, useState } from "react";
import {
  travelPreferencesStore,
  DEFAULT_TRAVEL_PREFERENCES,
} from "~/lib/store";

export type NavApp = "google_maps" | "waze";

type DriverSettingsContextType = {
  radius: number;
  navApp: NavApp;
  voiceNav: boolean;
  arrivalSounds: boolean;
  requestSounds: boolean;
  vibration: boolean;
  setRadius: (km: number) => void;
  setNavApp: (app: NavApp) => void;
  setVoiceNav: (v: boolean) => void;
  setArrivalSounds: (v: boolean) => void;
  setRequestSounds: (v: boolean) => void;
  setVibration: (v: boolean) => void;
};

const DriverSettingsContext = createContext<DriverSettingsContextType>({
  radius: 3,
  navApp: "google_maps",
  voiceNav: true,
  arrivalSounds: true,
  requestSounds: true,
  vibration: false,
  setRadius: () => {},
  setNavApp: () => {},
  setVoiceNav: () => {},
  setArrivalSounds: () => {},
  setRequestSounds: () => {},
  setVibration: () => {},
});

export function DriverSettingsProvider({ children }: React.PropsWithChildren) {
  const stored = travelPreferencesStore.get(["preferences"]);

  const [radius, _setRadius] = useState<number>(stored?.radius ?? 3);
  const [navApp, _setNavApp] = useState<NavApp>(
    (stored?.nav_app as NavApp) ?? "google_maps",
  );
  const [voiceNav, _setVoiceNav] = useState<boolean>(stored?.voice_nav ?? true);
  const [arrivalSounds, _setArrivalSounds] = useState<boolean>(
    stored?.arrival_sounds ?? true,
  );
  const [requestSounds, _setRequestSounds] = useState<boolean>(
    stored?.request_sounds ?? true,
  );
  const [vibration, _setVibration] = useState<boolean>(
    stored?.vibration ?? false,
  );

  const persist = useCallback((patch: Partial<typeof stored>) => {
    const current = travelPreferencesStore.get(["preferences"]);
    travelPreferencesStore.set(["preferences"], {
      ...DEFAULT_TRAVEL_PREFERENCES,
      ...current,
      ...patch,
    });
  }, []);

  const setRadius = useCallback(
    (km: number) => {
      _setRadius(km);
      persist({ radius: km });
    },
    [persist],
  );

  const setNavApp = useCallback(
    (app: NavApp) => {
      _setNavApp(app);
      persist({ nav_app: app });
    },
    [persist],
  );

  const setVoiceNav = useCallback(
    (v: boolean) => {
      _setVoiceNav(v);
      persist({ voice_nav: v });
    },
    [persist],
  );

  const setArrivalSounds = useCallback(
    (v: boolean) => {
      _setArrivalSounds(v);
      persist({ arrival_sounds: v });
    },
    [persist],
  );

  const setRequestSounds = useCallback(
    (v: boolean) => {
      _setRequestSounds(v);
      persist({ request_sounds: v });
    },
    [persist],
  );

  const setVibration = useCallback(
    (v: boolean) => {
      _setVibration(v);
      persist({ vibration: v });
    },
    [persist],
  );

  return (
    <DriverSettingsContext.Provider
      value={{
        radius,
        navApp,
        voiceNav,
        arrivalSounds,
        requestSounds,
        vibration,
        setRadius,
        setNavApp,
        setVoiceNav,
        setArrivalSounds,
        setRequestSounds,
        setVibration,
      }}
    >
      {children}
    </DriverSettingsContext.Provider>
  );
}

export function useDriverSettings() {
  return useContext(DriverSettingsContext);
}
