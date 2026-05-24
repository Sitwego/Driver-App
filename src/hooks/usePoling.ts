import { useQuery, useQueryClient, QueryKey } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useApiClient } from "./useApiClient";

type PollingOptions<TData, TId extends string | number> = {
  shouldPoll: boolean;
  id: TId;
  queryKeyPrefix: string;
  urlBuilder: (id?: TId) => string;
  // Optional: Override default polling interval if needed
  refetchInterval?: number;
};

const usePolling = <TData, TId extends string | number>({
  shouldPoll,
  id,
  queryKeyPrefix,
  urlBuilder,
  refetchInterval = 2000,
}: PollingOptions<TData, TId>) => {
  const queryClient = useQueryClient();
  const { makeApiCall } = useApiClient();
  const queryKey: QueryKey = useMemo(
    () => [queryKeyPrefix, id],
    [queryKeyPrefix, id],
  );

  useEffect(() => {
    if (!shouldPoll) {
      queryClient.removeQueries({ queryKey });
    }
  }, [queryClient, queryKey, shouldPoll]);

  const url = useMemo(() => urlBuilder(id), [urlBuilder, id]);

  return useQuery<TData, Error>({
    queryKey,
    queryFn: async (): Promise<TData> => {
      const abortController = new AbortController();
      return await makeApiCall({
        method: "GET",
        url,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: abortController.signal,
      });
    },
    enabled: shouldPoll,
    refetchInterval: shouldPoll ? refetchInterval : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 0,
    gcTime: 0,
    notifyOnChangeProps: ["data", "error"],
  });
};

export default usePolling;
