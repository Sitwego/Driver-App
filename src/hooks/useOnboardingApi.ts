import { useMutation } from "@tanstack/react-query";
import { useApiClient } from "./useApiClient";

export function useCreateDriverIdentityDocuments() {
  const { makeApiCall } = useApiClient();
  return useMutation<any, Error, IdentityDocsType>({
    async mutationFn({ id_type, ...rest }) {
      return await makeApiCall({
        url: "save-driver-identity-documents/" + id_type,
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
      console.log("Identity documents saved🎉✅ :");
    },
    onError(error, variables, context) {
      console.error("Error creating user:", error);
    },
    retry: 3,
  });
}

export function useCreateVehicleInfo() {
  const { makeApiCall } = useApiClient();
  return useMutation<any, Error, VehicleFormData>({
    async mutationFn({ ...props }) {
      return await makeApiCall({
        url: "save-vehicle-info/v-details",
        data: {
          ...props,
          year: Number(props.year),
          capacity: Number(props.capacity),
        } as VehicleFormData,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
      });
    },
    async onSuccess(data, variables, context) {
      console.log("Saved🎉✅ :");
    },
    onError(error) {
      console.log(error);
    },
  });
}

export function useCreateVehicleDocuments() {
  const { makeApiCall } = useApiClient();
  return useMutation<any, Error, VehicleDocuments>({
    async mutationFn({ document_type, ...rest }) {
      return await makeApiCall({
        url: `save-driver-documents/${document_type}`,
        data: rest,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
      });
    },
    async onSuccess(data, variables, context) {
      console.log("Saved🎉✅ :");
    },
    onError(error, variables, context) {
      console.log(error);
    },
  });
}

export function useSetDriverHasCompletedOnboarding() {
  const { makeApiCall } = useApiClient();
  return useMutation<any, Error, { hasOnboarded: boolean }>({
    async mutationFn({ hasOnboarded }) {
      return await makeApiCall({
        url: "set-driver-has-completed-onboarding",
        data: {
          has_completed_onboarding: hasOnboarded,
        },
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
      });
    },
    async onSuccess(data, variables, context) {
      console.log("Onboarding status updated🎉✅ :");
    },
    onError(error, variables, context) {
      console.error("Error updating onboarding status:", error);
    },
  });
}

export type IdentityDocsType = {
  id_number: string;
  id_type: string;
  file_id_front: string;
  front_nonce: number[];
  back_nonce: number[];
  file_id_back: string;
  back_encrypted_key: number[];
  front_encrypted_key: number[];
};

export type VehicleFormData = {
  vehicle_type: string;
  make: string;
  model: string;
  year: number;
  capacity: number;
  license_plate: string;
  color: string;
};

export type VehicleDocuments = {
  id: string;
  nonce: number[];
  expiry: string;
  document_type: string;
  encrypted_key: number[];
};
