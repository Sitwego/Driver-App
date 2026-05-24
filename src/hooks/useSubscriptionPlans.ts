import { useMutation } from "@tanstack/react-query";
import { useApiClient } from "./useApiClient";

export function useSetSubscriptionPlan() {
  const { makeApiCall } = useApiClient();
  return useMutation<
    any,
    Error,
    { plan_id: string; ontrial: boolean; sub_id: string }
  >({
    async mutationFn({ plan_id, ontrial, sub_id }) {
      return await makeApiCall({
        url: `create-subscriptions-plan/${plan_id}?ontrial=${ontrial}&sub_id=${sub_id}`,
        data: {},
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
      });
    },
    async onSuccess(data) {
      console.log("Subscription plan set🎉✅ :");
    },
    onError(error, variables, context) {
      console.error("Error setting Subscription plan:", error);
    },
    retry: 3,
  });
}

export type MpesaPromptResponse = {
  checkout_request_id?: string | null;
  customer_message?: string | null;
  merchant_request_id?: string | null;
  response_code: string;
  response_description?: string | null;
};

export function useSendMpesaPrompt() {
  const { makeApiCall } = useApiClient();
  return useMutation<
    MpesaPromptResponse,
    Error,
    { amount: number; phone_number: string; sub_id: string }
  >({
    async mutationFn({ sub_id, ...rest }) {
      return await makeApiCall({
        url: `payment/charge-phone-number/${sub_id}`,
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
      console.log("Mpesa prompt recieved successfully🎉✅ :");
    },
    onError(error, variables, context) {
      console.error("Error sending mpesa prompt:", error);
    },
    retry: 3,
  });
}
