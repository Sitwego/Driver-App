import React, { useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  focusManager,
  QueryClient,
  // onlineManager,
} from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
  PersistQueryClientProvider,
  // PersistQueryClientProviderProps,
} from "@tanstack/react-query-persist-client";

focusManager.setEventListener(() => {
  const sub = AppState.addEventListener("change", (status: AppStateStatus) => {
    focusManager.setFocused(status === "active");
  });

  return () => sub.remove;
});

const createNetQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // NOTE
        // refetchOnWindowFocus breaks some UIs (like feeds)
        // so we only selectively want to enable this
        // -prf
        refetchOnWindowFocus: true,
        // Structural sharing between responses makes it impossible to rely on
        // "first seen" timestamps on objects to determine if they're fresh.
        // Disable this optimization so that we can rely on "first seen" timestamps.
        structuralSharing: false,
        // We don't want to retry queries by default, because in most cases we
        // want to fail early and show a response to the user. There are
        // exceptions, and those can be made on a per-query basis. For others, we
        // should give users controls to retry.
        retry: false,
      },
    },
  });

export const NetworkQueryProvider = ({
  children,
  driverId,
}: {
  children: React.ReactNode;
  driverId?: string;
}) => {
  const currentDriverId = useRef(driverId);
  if (driverId !== currentDriverId.current) {
    throw Error(
      "Something is very wrong. Expected did to be stable due to key above.",
    );
  }
  const [netQueryClient, _] = useState(() => createNetQueryClient());

  const [persistOptions, __] = useState(() => {
    const asyncPersister = createAsyncStoragePersister({
      storage: AsyncStorage,
      key: "queryClient-" + (driverId ?? "logged-out"),
    });
    return {
      persister: asyncPersister,
      // dehydrateOptions,
    };
  });

  return (
    <PersistQueryClientProvider
      client={netQueryClient}
      persistOptions={persistOptions}
    >
      {children}
    </PersistQueryClientProvider>
  );
};
