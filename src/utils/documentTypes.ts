/**
 * The document type identifiers the API uses.
 *
 * These were inline string literals in `Submit.tsx` typed as bare `string`,
 * which meant a typo in one of them produced a runtime 500 from the server
 * rather than a compile error. They are extracted here because the documents
 * screen now needs the same set to read document status back.
 *
 * The values are the server's Rust *variant* names, not its database tokens
 * (the database stores `DRIVING_LICENSE`). The save route parses this form, so
 * this is the vocabulary already on the wire — do not "correct" it to
 * SCREAMING_SNAKE.
 */
export const DOCUMENT_TYPES = [
  "DrivingLicense",
  "PsvBadge",
  "PsvInsurance",
  "CertificateOfGoodConduct",
  "VehicleInspectionSticker",
  "Kra",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Fallback labels, used only when the server does not supply one.
 *
 * The server labels documents per vehicle class — a bike's licence reads
 * "Motorcycle Driving Licence (Class A)" — so its label wins whenever present.
 */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  DrivingLicense: "Driving License",
  PsvBadge: "PSV Badge",
  PsvInsurance: "Insurance",
  CertificateOfGoodConduct: "Police Clearance Certificate",
  VehicleInspectionSticker: "Vehicle Inspection Sticker",
  Kra: "KRA PIN Certificate",
};
