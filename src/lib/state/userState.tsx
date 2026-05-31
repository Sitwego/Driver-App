import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth } from "@react-native-firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect } from "react";

import usePolling from "~/hooks/usePoling";
import {
  useCreateDriver,
  useLoginDriver,
  useLogoutDriver,
} from "~/hooks/useUserApi";

import { locationPermissionStore } from "../location/LocationPermissionService";
import {
  locationStore,
  rideStore,
  travelPreferencesStore,
  userStore,
  vehicleCategoryStore,
} from "../store";

import { reducer } from "./reducer";
import {
  CreateAccountType,
  Driver,
  DriverStateApiContext,
  SimpleDriverProfileResponse,
} from "./type";

const StateContext = React.createContext<Driver | undefined>({
  isLoggedIn: false,
  profile_id: "",
  token: "",
});

const ApiContext = React.createContext<DriverStateApiContext>({
  createAccount: function (
    props: CreateAccountType,
  ): Promise<Pick<Driver, "profile_id" | "token">> {
    throw new Error("Function not implemented.");
  },
  login: function (props: {
    phone_number: string;
    password: string;
    device_id?: string | undefined;
    authFactorToken?: string | undefined;
  }): Promise<void> {
    throw new Error("Function not implemented.");
  },
  logout: function (): void {
    throw new Error("Function not implemented.");
  },
  deleteAccount: function (_account: Driver): void {
    throw new Error("Function not implemented.");
  },

  completeOnBoarding: function (
    hasOnboarded: Pick<Driver, "hasOnboarded">,
  ): Promise<void> {
    throw new Error("Function not implemented.");
  },
  updateProfile: function (_profile: Partial<Driver>): void {
    throw new Error("Function not implemented.");
  },
});

export const UserStateProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { mutateAsync: createAccount } = useCreateDriver();
  const { mutateAsync: loginDriver } = useLoginDriver();
  const { mutateAsync: logoutDriver } = useLogoutDriver();
  const queryClient = useQueryClient();
  const [state, setState] = React.useReducer(reducer, null, () => {
    const driver = userStore.get(["user"]);
    if (driver) {
      return {
        ...driver,
        isLoggedIn: driver.token ? true : false,
        profile_id: driver.profile_id,
        token: driver.token,
      };
    }
    // default values matching Driver type
    return {
      isLoggedIn: false,
      profile_id: "",
      token: "",
    };
  });

  const _createAccount = useCallback<DriverStateApiContext["createAccount"]>(
    async (props: CreateAccountType) => {
      const response = await createAccount(props);

      if (response) {
        setState({
          type: "CreateAccount",
          payload: {
            ...response,
            profile_id: response.profile_id || "",
            token: response.token || "",
            isLoggedIn: true,
          },
        });
      }
      return {};
    },
    [createAccount],
  );

  const login = useCallback<DriverStateApiContext["login"]>(
    async (props) => {
      const response = await loginDriver({
        phone_number: props.phone_number,
        password: props.password,
        device_id: props.device_id,
      });
      if (response) {
        setState({
          type: "LOGIN",
          payload: {
            ...response,
            profile_id: response.profile_id || "",
            token: response.token || "",
            isLoggedIn: true,
          },
        });
      }
    },
    [loginDriver],
  );

  const completeOnBoarding = useCallback(
    async (props: Partial<Driver> & { hasOnboarded: boolean }) => {
      if (!props.hasOnboarded) {
        throw new Error("Cannot complete onboarding without hasOnboarded flag");
      }
      setState({
        type: "SET_ONBOARDED",
        payload: props,
      });
    },
    [],
  );

  const updateProfile = useCallback((profile: Partial<Driver>) => {
    setState({
      type: "UPDATE_PROFILE",
      payload: profile,
    });
  }, []);

  const logout = useCallback(async () => {
    // Notify backend — fire-and-forget, never block the local logout on failure
    logoutDriver().catch(() => {});

    // Firebase sign out
    getAuth()
      .signOut()
      .catch(() => {});

    // Wipe all MMKV stores
    userStore.clearAll();
    rideStore.clearAll();
    vehicleCategoryStore.clearAll();
    travelPreferencesStore.clearAll();
    locationStore.clearAll();
    // Reset one-shot location-disclosure flags so the next driver on this
    // device sees the permission flow again.
    locationPermissionStore.clearAll();

    // Clear React Query in-memory cache and its AsyncStorage mirror
    queryClient.clear();
    AsyncStorage.removeItem("queryClient-logged-out").catch(() => {});

    // Update in-memory state — nativeStackNavigationWithAuth will redirect to <LoggedOut />
    setState({ type: "LOGOUT", payload: undefined });
  }, [logoutDriver, queryClient]);

  useEffect(() => {
    if (state.shouldPersist) {
      const { shouldPersist: _, ...persistedState } = state;
      userStore.set(["user"], persistedState as Driver);
    }
  }, [state]);

  const _state = React.useMemo(() => {
    return {
      ...state,
      isLoggedIn: state?.isLoggedIn ?? false,
      profile_id: state?.profile_id ?? "",
      token: state?.token ?? "",
    };
  }, [state]) as Driver;

  const _api = React.useMemo(
    () => ({
      createAccount: _createAccount,
      completeOnBoarding,
      updateProfile,
      login,
      logout,
      deleteAccount: (_account) => {
        throw new Error("Function not implemented.");
      },
    }),
    [_createAccount, completeOnBoarding, login, logout, updateProfile],
  ) as DriverStateApiContext;
  return (
    <StateContext.Provider value={_state}>
      <ApiContext.Provider value={_api}>
        <SimpleDriverProfile>{children}</SimpleDriverProfile>
      </ApiContext.Provider>
    </StateContext.Provider>
  );
};

const SimpleDriverProfile: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const state = useUserState();
  const { updateProfile } = useUserApi();
  // poll driver simple_profile every 2 seconds
  const { data: driverProfile } = usePolling<
    { data: SimpleDriverProfileResponse },
    string
  >({
    shouldPoll: state.isLoggedIn as boolean,
    id: state.profile_id,
    queryKeyPrefix: "driverProfile",
    urlBuilder: () => "get-driver-simple-profile",
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (driverProfile?.data?.categories) {
      console.log(
        "🚗 Driver categories from profile:",
        driverProfile.data.categories,
      );
      // Set the default category if not already set in the vehicle category store
      const isvcSet = vehicleCategoryStore.get(["categories"]);
      if (
        driverProfile.data?.categories.length > 0 &&
        (!isvcSet || isvcSet.length === 0)
      ) {
        // take the first category as the default selected category
        const defaultCategory = driverProfile.data?.categories[0];
        vehicleCategoryStore.set(["categories"], [defaultCategory]);
      }
    }
  }, [driverProfile]);
  // Update state with the fetched driver profile
  useEffect(() => {
    if (driverProfile) {
      // should show payment modal
      updateProfile({
        profile_id: driverProfile.data.driver_id,
        phone: driverProfile.data.phone,
        email: driverProfile.data.email,
        first_name: driverProfile.data.first_name,
        hasOnboarded: driverProfile.data.has_onboarded,
        activated: driverProfile.data.activated,
        isNew: driverProfile.data.is_new,
        verified: driverProfile.data.verified,
        isOnFreeTrial: driverProfile.data.is_on_free_trial,
        free_trial_end_date: driverProfile.data.free_trial_end_date,
        photo_id: driverProfile.data.photo_id,
        rating: driverProfile.data.rating,
        plan_end_date: driverProfile.data.plan_end_date,
        amount_due: driverProfile.data.amount_due,
        is_plan_active: driverProfile.data.is_plan_active,
        last_billed_at: driverProfile.data.last_billed_at,
        sub_id: driverProfile.data.sub_id,
        total_earnings: driverProfile.data.total_earnings,
        total_rides: driverProfile.data?.total_rides,
        categories: driverProfile.data?.categories,
        plan_id: driverProfile.data?.plan_id,
      } as Partial<Driver>);
    }
  }, [driverProfile, updateProfile]);
  return <>{children}</>;
};

export const useUserState = () => {
  const state = React.useContext(StateContext);
  if (!state) {
    throw new Error("useUserState must be used within a UserStateProvider");
  }
  return state;
};
export const useUserApi = () => {
  const api = React.useContext(ApiContext);
  if (!api) {
    throw new Error("useUserApi must be used within a UserStateProvider");
  }
  return api;
};
