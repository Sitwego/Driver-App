import { describe, expect, it } from "@jest/globals";

import {
  actionableCount,
  canUpload,
  documentImagePath,
  documentKey,
  formatReviewDate,
  pendingReplacement,
  rejectedReplacement,
  rejectionMessage,
  resubmissionNotice,
  statusDisplay,
  uploadActionLabel,
  type DocumentStatus,
  type DriverDocument,
} from "../documentStatus";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from "../documentTypes";

function doc(over: Partial<DriverDocument> = {}): DriverDocument {
  return {
    kind: "DOCUMENT",
    document_type: "DrivingLicense",
    required: true,
    label: "Driving License",
    status: "NOT_SUBMITTED",
    version: null,
    reason_code: null,
    reason_note: null,
    reviewed_at: null,
    replacement: null,
    expiry: null,
    doc_id: 1,
    has_back: false,
    ...over,
  };
}

describe("statusDisplay", () => {
  it("gives every status a distinct label and tone", () => {
    const statuses: DocumentStatus[] = [
      "APPROVED",
      "PENDING_REVIEW",
      "REJECTED",
      "NOT_SUBMITTED",
    ];
    const labels = statuses.map((s) => statusDisplay(s).label);
    expect(new Set(labels).size).toBe(statuses.length);
    expect(statusDisplay("APPROVED").tone).toBe("success");
    expect(statusDisplay("REJECTED").tone).toBe("danger");
  });

  // A newer server could add a status this build has never heard of. Falling
  // back to "under review" keeps the row honest; falling back to "rejected"
  // would accuse the driver of something that never happened.
  it("falls back to under review for an unknown status", () => {
    const unknown = "SOMETHING_NEW" as DocumentStatus;
    expect(statusDisplay(unknown).label).toBe("Under review");
    expect(statusDisplay(unknown).tone).toBe("pending");
  });
});

describe("rejectionMessage", () => {
  it("is null unless the document is rejected", () => {
    expect(rejectionMessage(doc({ status: "APPROVED" }))).toBeNull();
    expect(rejectionMessage(doc({ status: "PENDING_REVIEW" }))).toBeNull();
    expect(rejectionMessage(doc({ status: "NOT_SUBMITTED" }))).toBeNull();
  });

  it("renders the code when there is no note", () => {
    const m = rejectionMessage(
      doc({ status: "REJECTED", reason_code: "IMAGE_UNREADABLE" }),
    );
    expect(m).toMatch(/blurry/i);
  });

  it("prefers the admin's note over the generic code text", () => {
    const m = rejectionMessage(
      doc({
        status: "REJECTED",
        reason_code: "IMAGE_UNREADABLE",
        reason_note: "The back page is missing",
      }),
    );
    expect(m).toBe("The back page is missing");
  });

  it("falls back to the generic line when OTHER has a blank note", () => {
    const m = rejectionMessage(
      doc({ status: "REJECTED", reason_code: "OTHER", reason_note: "   " }),
    );
    expect(m).toBe("This document could not be accepted.");
  });

  // Rows rejected before reason codes existed carry neither code nor note.
  it("is null for a legacy rejection with no reason at all", () => {
    expect(rejectionMessage(doc({ status: "REJECTED" }))).toBeNull();
  });

  // An approved document keeps the headline "Approved", so a rejected
  // resubmission has nowhere else to surface. Without this the driver is never
  // told their upload failed and keeps sending the same bad photo.
  it("surfaces the reason when a replacement was rejected", () => {
    const m = rejectionMessage(
      doc({
        status: "APPROVED",
        replacement: {
          rejected: {
            version: 2,
            reason_code: "IMAGE_UNREADABLE",
            reason_note: "The expiry date is not readable.",
          },
        },
      }),
    );
    expect(m).toBe("The expiry date is not readable.");
  });

  it("falls back to the code text for a rejected replacement with no note", () => {
    const m = rejectionMessage(
      doc({
        status: "APPROVED",
        replacement: {
          rejected: {
            version: 2,
            reason_code: "NAME_MISMATCH",
            reason_note: null,
          },
        },
      }),
    );
    expect(m).toMatch(/name does not match/i);
  });

  it("says nothing for an approved document with a pending replacement", () => {
    const m = rejectionMessage(
      doc({ status: "APPROVED", replacement: { pending: { version: 2 } } }),
    );
    expect(m).toBeNull();
  });
});

describe("rejectedReplacement", () => {
  it("returns the rejected replacement's detail", () => {
    const r = rejectedReplacement(
      doc({
        status: "APPROVED",
        replacement: {
          rejected: {
            version: 3,
            reason_code: "EXPIRED_DOCUMENT",
            reason_note: null,
          },
        },
      }),
    );
    expect(r?.version).toBe(3);
    expect(r?.reason_code).toBe("EXPIRED_DOCUMENT");
  });

  it("is null for no replacement or a pending one", () => {
    expect(rejectedReplacement(doc({ status: "APPROVED" }))).toBeNull();
    expect(
      rejectedReplacement(
        doc({ status: "APPROVED", replacement: { pending: { version: 2 } } }),
      ),
    ).toBeNull();
  });
});

describe("replacement handling", () => {
  it("detects a pending replacement behind an approved document", () => {
    const d = doc({
      status: "APPROVED",
      replacement: { pending: { version: 2 } },
    });
    expect(pendingReplacement(d)).toBe(true);
  });

  it("does not treat a rejected replacement as pending", () => {
    const d = doc({
      status: "APPROVED",
      replacement: {
        rejected: {
          version: 2,
          reason_code: "EXPIRED_DOCUMENT",
          reason_note: null,
        },
      },
    });
    expect(pendingReplacement(d)).toBe(false);
  });
});

describe("canUpload", () => {
  it("allows a first upload and a fix after rejection", () => {
    expect(canUpload(doc({ status: "NOT_SUBMITTED" }))).toBe(true);
    expect(canUpload(doc({ status: "REJECTED" }))).toBe(true);
  });

  // An approved document has no button. This is the rule: a document an admin
  // verified must not be swappable afterwards, or the approval says nothing
  // about what the account is actually holding.
  it("blocks an approved document", () => {
    expect(canUpload(doc({ status: "APPROVED" }))).toBe(false);
  });

  // An expired document still reads APPROVED, so it is still frozen. Expiry is
  // when a document stops being valid, not when it stops having been verified.
  it("blocks an approved document even once it has expired", () => {
    expect(canUpload(doc({ status: "APPROVED", expiry: "2020-01-01" }))).toBe(
      false,
    );
  });

  it("allows an approved document an admin has unlocked", () => {
    expect(canUpload(doc({ status: "APPROVED", can_resubmit: true }))).toBe(
      true,
    );
  });

  // The rule is stated client-side rather than deferred to the server, so a
  // server that says nothing — an older build, a misconfiguration — can never
  // talk the app into offering a button that alters a verified document.
  it("keeps blocking when the server says nothing either way", () => {
    expect(canUpload(doc({ status: "APPROVED" }))).toBe(false);
    expect(canUpload(doc({ status: "APPROVED", can_resubmit: false }))).toBe(
      false,
    );
  });

  it("blocks while a submission is awaiting review", () => {
    expect(canUpload(doc({ status: "PENDING_REVIEW" }))).toBe(false);
  });

  it("blocks while a replacement is awaiting review", () => {
    const d = doc({
      status: "APPROVED",
      replacement: { pending: { version: 2 } },
    });
    expect(canUpload(d)).toBe(false);
  });
});

describe("resubmissionNotice", () => {
  // The ID, the passport, the photo, the licence — all the same answer, since
  // the button is gone for good rather than until a date.
  it("points at support for an approved document", () => {
    expect(resubmissionNotice(doc({ status: "APPROVED" }))).toContain(
      "Contact support",
    );
  });

  it("says nothing when the button is there", () => {
    expect(resubmissionNotice(doc({ status: "NOT_SUBMITTED" }))).toBeNull();
    expect(resubmissionNotice(doc({ status: "REJECTED" }))).toBeNull();
    expect(
      resubmissionNotice(doc({ status: "APPROVED", can_resubmit: true })),
    ).toBeNull();
  });

  // A replacement under review already has its own line on the row; two
  // explanations for one missing button reads as a fault.
  it("defers to the replacement line when one is pending", () => {
    const d = doc({
      status: "APPROVED",
      replacement: { pending: { version: 2 } },
    });
    expect(resubmissionNotice(d)).toBeNull();
  });

  // Nothing to explain: the button is missing because a review is in flight,
  // which the status badge already says.
  it("says nothing for a document under review", () => {
    expect(resubmissionNotice(doc({ status: "PENDING_REVIEW" }))).toBeNull();
  });
});

describe("uploadActionLabel", () => {
  it("says Upload only for a document never submitted", () => {
    expect(uploadActionLabel(doc({ status: "NOT_SUBMITTED" }))).toBe("Upload");
    expect(uploadActionLabel(doc({ status: "REJECTED" }))).toBe("Resubmit");
    // Still "Resubmit" — an approved document only reaches the button when an
    // admin reopened it, and replacing it is exactly what the driver is doing.
    expect(uploadActionLabel(doc({ status: "APPROVED" }))).toBe("Resubmit");
  });
});

describe("actionableCount", () => {
  it("counts required documents that are rejected or missing", () => {
    const docs = [
      doc({ status: "REJECTED" }),
      doc({ status: "NOT_SUBMITTED" }),
      doc({ status: "APPROVED" }),
      doc({ status: "PENDING_REVIEW" }),
    ];
    expect(actionableCount(docs)).toBe(2);
  });

  it("ignores optional documents", () => {
    const docs = [
      doc({ status: "NOT_SUBMITTED", required: false }),
      doc({ status: "REJECTED", required: false }),
    ];
    expect(actionableCount(docs)).toBe(0);
  });

  it("is zero for a fully approved driver", () => {
    expect(actionableCount([doc({ status: "APPROVED" })])).toBe(0);
  });
});

describe("documentImagePath", () => {
  it("addresses a typed document by kind and row id", () => {
    expect(documentImagePath(doc({ status: "APPROVED", doc_id: 42 }))).toBe(
      "driver/documents/document/42/image",
    );
  });

  it("addresses an identity document on the identity route", () => {
    const d = doc({ kind: "IDENTITY", status: "APPROVED", doc_id: 7 });
    expect(documentImagePath(d)).toBe("driver/documents/identity/7/image");
  });

  it("serves the back side only when one was captured", () => {
    const withBack = doc({
      kind: "IDENTITY",
      status: "APPROVED",
      doc_id: 7,
      has_back: true,
    });
    expect(documentImagePath(withBack, "back")).toBe(
      "driver/documents/identity/7/image?side=back",
    );
    const noBack = doc({ kind: "IDENTITY", status: "APPROVED", doc_id: 7 });
    expect(documentImagePath(noBack, "back")).toBeNull();
  });

  // The photo hangs off the driver row, so it has no id of its own to send.
  it("addresses the profile photo without needing a row id", () => {
    const d = doc({ kind: "PHOTO", status: "APPROVED", doc_id: null });
    expect(documentImagePath(d)).toBe("driver/documents/photo/0/image");
  });

  // The photo is single-sided; without this the viewer showed it twice.
  it("has no back side for a profile photo", () => {
    const d = doc({ kind: "PHOTO", status: "APPROVED", doc_id: null });
    expect(documentImagePath(d, "back")).toBeNull();
  });

  it("has no image for a document never submitted", () => {
    expect(documentImagePath(doc({ status: "NOT_SUBMITTED" }))).toBeNull();
  });

  // Requesting an image with no id would return whatever row that id hit.
  it("has no image when the row id is missing", () => {
    expect(
      documentImagePath(doc({ status: "APPROVED", doc_id: null })),
    ).toBeNull();
  });
});

describe("documentKey", () => {
  // A driver may hold a national ID and a passport; keying on the type alone
  // also collides between a typed document and an identity subtype.
  it("separates rows of different kinds", () => {
    const a = documentKey(doc({ kind: "IDENTITY", document_type: "PASSPORT" }));
    const b = documentKey(doc({ kind: "DOCUMENT", document_type: "PASSPORT" }));
    expect(a).not.toBe(b);
  });
});

describe("formatReviewDate", () => {
  it("returns null for missing or unparseable dates", () => {
    expect(formatReviewDate(null)).toBeNull();
    expect(formatReviewDate("not a date")).toBeNull();
  });

  it("formats a real timestamp", () => {
    expect(formatReviewDate("2026-08-11T10:30:00Z")).toContain("2026");
  });
});

describe("document types", () => {
  // The server parses these as Rust variant names. If one is "corrected" to
  // SCREAMING_SNAKE the save call 500s at runtime with no compile-time signal,
  // so pin the exact strings.
  it("uses the server's variant-name vocabulary", () => {
    expect(DOCUMENT_TYPES).toEqual([
      "DrivingLicense",
      "PsvBadge",
      "PsvInsurance",
      "CertificateOfGoodConduct",
      "VehicleInspectionSticker",
      "Kra",
    ]);
  });

  it("has a fallback label for every type", () => {
    for (const t of DOCUMENT_TYPES) {
      expect(DOCUMENT_TYPE_LABELS[t]).toBeTruthy();
    }
  });
});
