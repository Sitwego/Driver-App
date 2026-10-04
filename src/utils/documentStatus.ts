/**
 * Presentation rules for driver document status.
 *
 * The server decides what a document's status *is* (it owns the version
 * history); this module decides how that reads on screen. Kept free of React
 * and react-native imports so it can be unit tested — `jest.config.js` only
 * roots `src/tracking`, `src/components/AppBottomSheet`, and `src/utils`.
 */

import type { icons as LucideIcons } from "lucide-react-native";

import type { DocumentType } from "./documentTypes";

/** Same icon vocabulary the shared `Icon` component accepts. */
type IconName = keyof typeof LucideIcons;

/** Mirrors the server's `DerivedDocStatus`. */
export type DocumentStatus =
  | "NOT_SUBMITTED"
  | "PENDING_REVIEW"
  | "REJECTED"
  | "APPROVED";

/** Mirrors the server's `document_reject_reason` enum. */
export type RejectReason =
  | "IMAGE_UNREADABLE"
  | "PARTIAL_DOCUMENT"
  | "WRONG_DOCUMENT_TYPE"
  | "EXPIRED_DOCUMENT"
  | "NAME_MISMATCH"
  | "OTHER";

/** A newer submission sitting behind an approved version. */
export type Replacement =
  | { pending: { version: number } }
  | {
      rejected: {
        version: number;
        reason_code: RejectReason | null;
        reason_note: string | null;
      };
    };

/**
 * Which store a document came from. The driver sees one list, but the three
 * kinds live in different tables and each has its own upload endpoint and image
 * route, so the client has to keep them apart.
 */
export type DocumentKind = "DOCUMENT" | "IDENTITY" | "PHOTO";

/** One row of `GET /driver/documents`. */
export type DriverDocument = {
  kind: DocumentKind;
  /**
   * The variant name for typed documents (`DrivingLicense`), the subtype for
   * identity documents, `ProfilePhoto` for the photo. Only `DOCUMENT` rows
   * carry a `DocumentType`.
   */
  document_type: DocumentType | string;
  required: boolean;
  label: string;
  status: DocumentStatus;
  version: number | null;
  reason_code: RejectReason | null;
  reason_note: string | null;
  reviewed_at: string | null;
  replacement: Replacement | null;
  expiry: string | null;
  /** The row the status refers to; what the image route needs. */
  doc_id: number | null;
  /** Identity documents are two-sided; nothing else is. */
  has_back: boolean;
  /**
   * Whether the driver may replace this document right now.
   *
   * `false` for every approved document unless an admin has reopened it. The
   * server decides; this is only echoed here so the app and the upload endpoint
   * cannot disagree about the same document.
   *
   * Optional because a build of this app can outlive the server it talks to —
   * see {@link canUpload}, which does not depend on it.
   */
  can_resubmit?: boolean;
};

/**
 * Path of the image for a document, relative to the API base, or `null` when
 * there is nothing uploaded to show.
 *
 * The photo is addressed by driver rather than by row, so it needs no id — but
 * every other kind does, and asking for one without an id would return another
 * driver's document or a 404 depending on the id that happened to be there.
 */
export function documentImagePath(
  doc: DriverDocument,
  side: "front" | "back" = "front",
): string | null {
  if (doc.status === "NOT_SUBMITTED") return null;
  // Only identity documents have a second side; asking for the back of
  // anything else would otherwise return the front a second time and the
  // viewer would show the same page twice.
  if (side === "back" && !doc.has_back) return null;
  if (doc.kind === "PHOTO") return "driver/documents/photo/0/image";
  if (doc.doc_id == null) return null;
  const kind = doc.kind === "IDENTITY" ? "identity" : "document";
  const query = side === "back" ? "?side=back" : "";
  return `driver/documents/${kind}/${doc.doc_id}/image${query}`;
}

/**
 * A stable list key. `document_type` alone collides once a driver holds two
 * identity documents whose subtype strings match nothing else in the list.
 */
export function documentKey(doc: DriverDocument): string {
  return `${doc.kind}:${doc.document_type}`;
}

/**
 * What each reason code means to a driver.
 *
 * Deliberately phrased as what to do next rather than what was wrong — the
 * driver reads this to decide whether to re-photograph or find a new document.
 * These are the strings that get translated when the app ships Swahili; the
 * server sends the code precisely so this stays a client-side lookup.
 */
export const REJECT_REASON_TEXT: Record<RejectReason, string> = {
  IMAGE_UNREADABLE: "The photo was too blurry to read. Please retake it.",
  PARTIAL_DOCUMENT:
    "Part of the document was cut off. Please capture the whole page.",
  WRONG_DOCUMENT_TYPE: "This is not the document we asked for.",
  EXPIRED_DOCUMENT: "This document has expired. Please upload a current one.",
  NAME_MISMATCH: "The name does not match your profile.",
  OTHER: "This document could not be accepted.",
};

export type StatusDisplay = {
  label: string;
  /** Which semantic colour the row should use. */
  tone: "success" | "pending" | "danger" | "muted";
  icon: IconName;
};

const STATUS_DISPLAY: Record<DocumentStatus, StatusDisplay> = {
  APPROVED: { label: "Approved", tone: "success", icon: "CircleCheck" },
  PENDING_REVIEW: { label: "Under review", tone: "pending", icon: "Clock" },
  REJECTED: { label: "Rejected", tone: "danger", icon: "CircleX" },
  NOT_SUBMITTED: { label: "Not submitted", tone: "muted", icon: "Circle" },
};

/**
 * How a status renders.
 *
 * An unrecognised status from a newer server reads as "under review" rather
 * than throwing: the driver sees something honest and inert instead of a blank
 * row, and it never wrongly tells them a document was rejected.
 */
export function statusDisplay(status: DocumentStatus): StatusDisplay {
  return STATUS_DISPLAY[status] ?? STATUS_DISPLAY.PENDING_REVIEW;
}

/**
 * A note the admin wrote wins over the generic code text, because it is
 * specific to this driver's document. `OTHER` without a note falls back to the
 * generic line rather than showing nothing.
 */
function reasonText(
  code: RejectReason | null,
  note: string | null,
): string | null {
  if (note?.trim()) return note.trim();
  if (code) return REJECT_REASON_TEXT[code] ?? null;
  return null;
}

/**
 * The rejected newer version sitting behind an approved document.
 *
 * This is the case the driver would otherwise never hear about: their approved
 * document keeps the row reading "Approved", so a rejected resubmission would
 * disappear silently and they would keep uploading the same bad photo.
 */
export function rejectedReplacement(doc: DriverDocument): {
  version: number;
  reason_code: RejectReason | null;
  reason_note: string | null;
} | null {
  if (!doc.replacement || !("rejected" in doc.replacement)) return null;
  return doc.replacement.rejected;
}

/**
 * The rejection message for a document, or `null` if there is nothing to say —
 * covering both a rejected document and a rejected replacement.
 */
export function rejectionMessage(doc: DriverDocument): string | null {
  if (doc.status === "REJECTED") {
    return reasonText(doc.reason_code, doc.reason_note);
  }
  const replaced = rejectedReplacement(doc);
  if (replaced) return reasonText(replaced.reason_code, replaced.reason_note);
  return null;
}

/**
 * Whether a replacement the driver already submitted is awaiting review.
 *
 * Drives the "approved, new version under review" line: without it an approved
 * document would look unchanged after a resubmission and the driver would have
 * no signal that their upload landed.
 */
export function pendingReplacement(doc: DriverDocument): boolean {
  return !!doc.replacement && "pending" in doc.replacement;
}

/**
 * Whether the driver can act on this document right now.
 *
 * **An approved document has no upload button.** That is the rule, and it is
 * stated here as `status === "APPROVED"` rather than deferred to the server's
 * `can_resubmit`, so an older or misconfigured server can never talk this app
 * into offering a button that alters a verified document. `can_resubmit` is
 * consulted only to *re-open* one an admin has explicitly unlocked, which is
 * information this app cannot derive on its own.
 *
 * Note that an expired document still reads APPROVED, so it is still frozen.
 * That is intended: expiry is when a document stops being valid, not when it
 * stops having been verified, and renewals go through an admin.
 *
 * The remaining refusal is ours rather than the server's: there is no point
 * uploading a third copy while the second is queued, and doing so only churns
 * versions.
 */
export function canUpload(doc: DriverDocument): boolean {
  if (doc.status === "APPROVED" && doc.can_resubmit !== true) return false;
  if (doc.status === "PENDING_REVIEW") return false;
  if (pendingReplacement(doc)) return false;
  return true;
}

/**
 * Why the upload button is missing from an approved document.
 *
 * Without this the row simply loses its button and reads as broken. `null`
 * whenever there is nothing to explain — the button is there, or it is missing
 * for a reason the row already shows (a replacement under review has its own
 * line).
 */
export function resubmissionNotice(doc: DriverDocument): string | null {
  if (canUpload(doc)) return null;
  if (doc.status !== "APPROVED") return null;
  if (pendingReplacement(doc)) return null;

  return "Approved documents can't be replaced. Contact support if this has changed.";
}

/** Button wording, which differs for a first upload vs a fix. */
export function uploadActionLabel(doc: DriverDocument): string {
  return doc.status === "NOT_SUBMITTED" ? "Upload" : "Resubmit";
}

/**
 * Documents needing the driver's attention, for the badge on the menu entry.
 * Optional documents never count — nothing is wrong if a driver skips KRA.
 */
export function actionableCount(docs: DriverDocument[]): number {
  return docs.filter(
    (d) =>
      d.required && (d.status === "REJECTED" || d.status === "NOT_SUBMITTED"),
  ).length;
}

/** Format a review date for display; invalid or missing dates render as null. */
export function formatReviewDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
