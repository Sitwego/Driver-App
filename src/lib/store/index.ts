import { useCallback, useEffect, useState } from "react";
import { MMKV, createMMKV } from "react-native-mmkv";
import { Driver } from "../state/type";

export type RideShema = {
  ride?: Record<string, any>;
  rideStatus?: object;
  /** Unix ms timestamp recorded when the driver marks arrival at the pickup location. */
  arrivedAt?: number;
  /** KSH charge accrued during overtime waiting. Persisted when the ride starts so it survives app restarts. */
  overtimeCharge?: number;
};

export type UserSchema = {
  user: Driver;
};

/**
 * Generic storage class. DO NOT use this directly. Instead, use the exported
 * storage instances below.
 */
export class Storage<Scopes extends unknown[], Schema> {
  protected sep = ":";
  protected store: MMKV;

  constructor({ id }: { id: string }) {
    this.store = createMMKV({ id });
  }

  /**
   * Store a value in storage based on scopes and/or keys
   *
   *   `set([key], value)`
   *   `set([scope, key], value)`
   */
  set<Key extends keyof Schema>(
    scopes: [...Scopes, Key],
    data: Schema[Key],
  ): void {
    // stored as `{ data: <value> }` structure to ease stringification
    this.store.set(scopes.join(this.sep), JSON.stringify({ data }));
  }

  /**
   * Get a value from storage based on scopes and/or keys
   *
   *   `get([key])`
   *   `get([scope, key])`
   */
  get<Key extends keyof Schema>(
    scopes: [...Scopes, Key],
  ): Schema[Key] | undefined {
    const res = this.store.getString(scopes.join(this.sep));
    if (!res) return undefined;
    // parsed from storage structure `{ data: <value> }`
    return JSON.parse(res).data;
  }

  /**
   * Remove a value from storage based on scopes and/or keys
   *
   *   `remove([key])`
   *   `remove([scope, key])`
   */
  remove<Key extends keyof Schema>(scopes: [...Scopes, Key]) {
    this.store.remove(scopes.join(this.sep));
  }

  /**
   * Remove many values from the same storage scope by keys
   *
   *   `removeMany([], [key])`
   *   `removeMany([scope], [key])`
   */
  removeMany<Key extends keyof Schema>(scopes: [...Scopes], keys: Key[]) {
    keys.forEach((key) => this.remove([...scopes, key]));
  }

  clearAll() {
    this.store.clearAll();
  }

  /**
   * Fires a callback when the storage associated with a given key changes
   *
   * @returns Listener - call `remove()` to stop listening
   */
  addOnValueChangedListener<Key extends keyof Schema>(
    scopes: [...Scopes, Key],
    callback: () => void,
  ) {
    return this.store.addOnValueChangedListener((key) => {
      if (key === scopes.join(this.sep)) {
        callback();
      }
    });
  }
}

type StorageSchema<T extends Storage<any, any>> =
  T extends Storage<any, infer U> ? U : never;
type StorageScopes<T extends Storage<any, any>> =
  T extends Storage<infer S, any> ? S : never;

/**
 * Hook to use a storage instance. Acts like a useState hook, but persists the
 * value in storage.
 */
export function useStorage<
  Store extends Storage<any, any>,
  Key extends keyof StorageSchema<Store>,
>(
  storage: Store,
  scopes: [...StorageScopes<Store>, Key],
): [
  StorageSchema<Store>[Key] | undefined,
  (data: StorageSchema<Store>[Key]) => void,
] {
  type Schema = StorageSchema<Store>;
  const [value, setValue] = useState<Schema[Key] | undefined>(() =>
    storage.get(scopes),
  );

  useEffect(() => {
    const sub = storage.addOnValueChangedListener(scopes, () => {
      setValue(storage.get(scopes));
    });
    return () => sub.remove();
  }, [storage, scopes]);

  const setter = useCallback(
    (data: Schema[Key]) => {
      setValue(data);
      storage.set(scopes, data);
    },
    [storage, scopes],
  );

  return [value, setter] as const;
}

/**
 * Ride data
 *
 *   `rideStore.set([key], {})`
 */
export const rideStore = new Storage<[], RideShema>({ id: "ACTIVE_RIDE_DATA" });

/**
 * User data
 *
 *   `userStore.set([key], {})`
 */
export const userStore = new Storage<[], UserSchema>({ id: "USER_DATA" });

/**
 * For saving eligible vehicle categories for the driver.
 *  `vehicleCategoryStore.set([key], ["Swift", "Comfort"])`
 */
export const vehicleCategoryStore = new Storage<[], { categories: string[] }>({
  id: "VEHICLE_CATEGORY_DATA",
});

/** Strongly-typed core travel preference fields. Used for the PUT request body. */
export type TravelPreferences = {
  chattiness: string;
  music: string;
  smoking: string;
  pets: string;
};

/**
 * All driver preferences stored locally.
 * Extends travel prefs with optional well-known fields.
 * Any future preference can be added here or stored via the index signature.
 */
export type DriverPreferences = TravelPreferences & {
  bio?: string;
  radius?: number;
  nav_app?: "google_maps" | "waze";
  voice_nav?: boolean;
  arrival_sounds?: boolean;
  request_sounds?: boolean;
  vibration?: boolean;
  notif_sound?: string;
  [key: string]: unknown;
};

export type DriverPreferencesSchema = {
  preferences: DriverPreferences;
};

export const DEFAULT_TRAVEL_PREFERENCES: TravelPreferences = {
  chattiness: "considerate",
  music: "mood",
  smoking: "nosmoking",
  pets: "no_pets",
};

/**
 * Driver preferences store (travel, bio, radius, notif sound, …).
 *  `travelPreferencesStore.set(["preferences"], { chattiness: "considerate", ... })`
 */
export const travelPreferencesStore = new Storage<[], DriverPreferencesSchema>({
  id: "TRAVEL_PREFERENCES_DATA",
});

export type NetworkStatus = "online" | "offline" | "unknown";

export type NetworkSchema = {
  /** Whether the app currently has no internet */
  isOffline: boolean;
  /** Whether our backend server is reachable (distinct from general internet) */
  isServerUp: boolean;
  /** Coarse connection quality label */
  networkStatus: NetworkStatus;
  /** ISO timestamp of the last time the app went offline */
  lastOfflineAt: string;
  /** Tracks how many times the connection toggled within a rolling hour */
  connectionChanges: { startTime: number; amount: number };
  /** When true, the app behaves as if offline regardless of actual network */
  shouldForceOffline: boolean;
};

/**
 * Network / connectivity state persisted across app restarts.
 *
 *   `networkStore.set(["isOffline"], true)`
 *   `networkStore.get(["networkStatus"])` → "online" | "offline" | "unknown"
 */
export const networkStore = new Storage<[], NetworkSchema>({
  id: "NETWORK_STATE",
});

/** Kalman-filtered GPS fix written by the GeoKalman foreground service. */
export type CurrentLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  /** Total Geohash-filtered distance travelled (metres). */
  distance: number;
  bearing: number;
  altitude: number;
  isMoving: boolean;
  /** Unix ms timestamp from the raw Location object. */
  timestamp: number;
};

export type LocationSchema = {
  location: CurrentLocation;
};

/**
 * Last Kalman-filtered GPS fix written by the GeoKalman Android service.
 * Updated on every `locationChanged` callback — read this instead of (or in
 * addition to) the `onGeoKalman` event emitter when you need the current
 * position without an active listener.
 *
 *   `locationStore.get(["location"])` → CurrentLocation | undefined
 */
export const locationStore = new Storage<[], LocationSchema>({
  id: "CURRENT_LOCATION",
});
