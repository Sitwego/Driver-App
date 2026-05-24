import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";

import { CreateAccountType, Driver } from "~/lib/state/type";

import { useApiClient } from "./useApiClient";

export function useCreateDriver() {
  const { makeApiCall } = useApiClient();
  return useMutation<Driver, Error, CreateAccountType>({
    async mutationFn({ ...rest }) {
      return await makeApiCall({
        url: "create-profile/driver",
        data: rest,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
      });
    },
    async onSuccess(data: any) {
      console.log("User created successfully:");
    },
    onError(error, variables, context) {
      console.error("Error creating user:", error);
    },
    retry: 3,
  });
}

export function useLoginDriver() {
  const { makeApiCall } = useApiClient();
  return useMutation<
    Driver,
    Error,
    { phone_number: string; password: string; device_id?: string }
  >({
    async mutationFn({ phone_number, password, device_id }) {
      return await makeApiCall({
        url: "login-driver",
        data: { phone_number, device_id, password },
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
      });
    },
    async onSuccess(data: any) {
      console.log("User logged in successfully:");
    },
    onError(error, variables, context) {
      console.error("Error logging in user:", error);
    },
    retry: 3,
  });
}
export function useUpdatePushToken() {
  const { makeApiCall } = useApiClient();
  return useMutation<any, Error, { device_type: string; device_token: string }>(
    {
      async mutationFn({ device_type, device_token }) {
        return await makeApiCall({
          url: "api/profile/device-info",
          data: { device_type, device_token },
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          unmountSignal: new AbortController().signal,
        });
      },
      onSuccess() {
        console.log("Push token updated successfully");
      },
      onError(error) {
        console.error("Error updating push token:", error);
      },
    },
  );
}

export function useLogoutDriver() {
  const { makeApiCall } = useApiClient();
  return useMutation<void, Error>({
    async mutationFn() {
      return await makeApiCall({
        url: "logout-driver",
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
    },
  });
}

export function useSetDriverPhoto() {
  const { makeApiCall } = useApiClient();
  return useMutation<
    any,
    Error,
    { photo_id: string; photo_nonce: number[]; photo_encrypted_key: number[] }
  >({
    async mutationFn(props) {
      return await makeApiCall({
        url: "set-driver-photo",
        data: props,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
      });
    },
    onSuccess(data, variables, context) {
      console.log("Photo Saved🎉✅ :");
    },
    onError(error, variables, context) {
      console.log(error);
    },
  });
}
