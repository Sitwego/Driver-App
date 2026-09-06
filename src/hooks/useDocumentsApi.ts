import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { useConfig } from "~/lib/Providers/RemoteConfigProvider";
import { useUserState } from "~/lib/state/userState";
import { documentImagePath } from "~/utils/documentStatus";

import { useApiClient } from "./useApiClient";
import type { DriverDocument } from "~/utils/documentStatus";
import type { DocumentType } from "~/utils/documentTypes";

export const DRIVER_DOCUMENTS_KEY = ["driver-documents"] as const;

export type DriverDocumentVersion = {
  id: number;
  version: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason_code: DriverDocument["reason_code"];
  reason_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

/**
 * The driver's documents and their review state.
 *
 * Refetches on screen focus and on app foreground (the query client sets
 * `refetchOnWindowFocus` globally and wires `focusManager` to AppState), because
 * approval happens on someone else's schedule — a driver who was rejected while
 * the app was backgrounded must see it as soon as they look.
 */
export function useDriverDocuments() {
  const { fetcher } = useApiClient();

  const query = useQuery<DriverDocument[]>({
    queryKey: DRIVER_DOCUMENTS_KEY,
    queryFn: () => fetcher("driver/documents"),
  });

  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return query;
}

/**
 * Build an `Image` source for a document's thumbnail, or `null` when there is
 * nothing uploaded to show.
 *
 * The image route is authenticated, so the token has to travel with the request
 * — a bare URI would render a 401 body as a broken image. React Native's
 * `Image` accepts request headers for exactly this.
 */
export function useDocumentImageSource() {
  const { token } = useUserState();
  const { API_BASE_URL } = useConfig();

  return useCallback(
    (doc: DriverDocument, side: "front" | "back" = "front") => {
      const path = documentImagePath(doc, side);
      if (!path || !token) return null;
      return {
        uri: `${API_BASE_URL.replace(/\/$/, "")}/${path}`,
        headers: { Authorization: `Bearer ${token}` },
      };
    },
    [API_BASE_URL, token],
  );
}

/** Every version of one document type, newest first. */
export function useDriverDocumentHistory(
  documentType: DocumentType,
  enabled: boolean,
) {
  const { fetcher } = useApiClient();

  return useQuery<DriverDocumentVersion[]>({
    queryKey: ["driver-document-history", documentType],
    queryFn: () => fetcher(`driver/documents/${documentType}/history`),
    enabled,
  });
}

/**
 * Mark a document as submitted without waiting for the server to confirm.
 *
 * §9 requires the row to read "Under review" the instant an upload succeeds. A
 * plain invalidate leaves the old value on screen until the refetch lands, so a
 * driver who just fixed a rejected document would keep seeing "Rejected" and
 * would reasonably upload again.
 */
export function useMarkDocumentSubmitted() {
  const queryClient = useQueryClient();

  return useCallback(
    (documentType: DocumentType | string) => {
      queryClient.setQueryData<DriverDocument[]>(DRIVER_DOCUMENTS_KEY, (prev) =>
        prev?.map((doc) => {
          if (doc.document_type !== documentType) return doc;
          // The photo has no versions — re-uploading replaces it outright, so
          // it goes straight back to pending rather than gaining a
          // "replacement" it can never have.
          if (doc.kind === "PHOTO") {
            return {
              ...doc,
              status: "PENDING_REVIEW" as const,
              reason_code: null,
              reason_note: null,
            };
          }
          // An approved document keeps its status — the new upload is a
          // replacement, and saying otherwise would imply the driver had
          // just lost an approval they still hold.
          if (doc.status === "APPROVED") {
            return {
              ...doc,
              replacement: { pending: { version: (doc.version ?? 1) + 1 } },
            };
          }
          return {
            ...doc,
            status: "PENDING_REVIEW" as const,
            reason_code: null,
            reason_note: null,
          };
        }),
      );
      queryClient.invalidateQueries({ queryKey: DRIVER_DOCUMENTS_KEY });
      queryClient.invalidateQueries({
        queryKey: ["driver-document-history", documentType],
      });
    },
    [queryClient],
  );
}
