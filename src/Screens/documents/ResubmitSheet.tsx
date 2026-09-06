import { PressableScale as Pressable } from "pressto";
import { memo, useCallback, useRef, useState } from "react";
import { Modal } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import RnTextInput from "~/components/RnTextInput";
import { RnView } from "~/components/RnView";
import { useMarkDocumentSubmitted } from "~/hooks/useDocumentsApi";
import useFileUpload from "~/hooks/useFileUpload";
import {
  useCreateDriverIdentityDocuments,
  useCreateVehicleDocuments,
} from "~/hooks/useOnboardingApi";
import { useSetDriverPhoto } from "~/hooks/useUserApi";
import { s } from "~/styles/Common-Styles";
import { DateFieldRef, DateInputField } from "~/ui/DateComponent";
import ImagePickerFormController from "~/ui/onboarding/docs/ImagePickerFormController";
import { createDocFormData } from "~/ui/onboarding/docs/uploadUtils";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { toSimpleDateString } from "~/utils/dates/simpleDateString";

import type { FileUploadResponseType } from "~/ui/onboarding/state";
import type { DriverDocument } from "~/utils/documentStatus";

/** Document types the server stores without an expiry date. */
const NO_EXPIRY: ReadonlySet<string> = new Set(["Kra"]);

/**
 * Re-upload one document from the documents screen.
 *
 * Deliberately not the onboarding modal for this document type: those are wired
 * into the onboarding reducer (`useOnboardingControls`), which only exists
 * inside the onboarding flow. This does the same two steps — upload the file,
 * then attach it to the document type — against the same endpoints, and reuses
 * the same picker and date field.
 */
export const ResubmitSheet = memo(function ResubmitSheet({
  doc,
  onClose,
}: {
  doc: DriverDocument;
  onClose: () => void;
}) {
  const { colors, fonts } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dateRef = useRef<DateFieldRef>(null);

  const { uploadFile, isUploading } = useFileUpload();
  const saveDocument = useCreateVehicleDocuments();
  const saveIdentity = useCreateDriverIdentityDocuments();
  const savePhoto = useSetDriverPhoto();
  const markSubmitted = useMarkDocumentSubmitted();

  // Only typed documents carry an expiry; an identity document's validity is
  // read off the document itself, and a profile photo never expires.
  const needsExpiry =
    doc.kind === "DOCUMENT" && !NO_EXPIRY.has(doc.document_type);
  // Two-sided, and the id number is part of the record, so a resubmission has
  // to send all three or the server would store a half-populated row.
  const isIdentity = doc.kind === "IDENTITY";

  const [expiry, setExpiry] = useState(
    () => doc.expiry ?? toSimpleDateString(new Date()),
  );
  const [idNumber, setIdNumber] = useState("");
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState<FileUploadResponseType>();
  const [backPreview, setBackPreview] = useState("");
  const [backFile, setBackFile] = useState<FileUploadResponseType>();
  const [error, setError] = useState<string | null>(null);

  const pickInto = useCallback(
    async (
      uri: string,
      setF: (f: FileUploadResponseType) => void,
      setP: (u: string) => void,
    ) => {
      setError(null);
      try {
        const res = await uploadFile({
          endPoint: "driver/upload-documents",
          formData: createDocFormData(uri, doc.document_type),
        });
        if (!res.data) {
          throw new Error("no upload response");
        }
        const { id, nonce, encrypted_key } = res.data;
        setF({ id, nonce, encrypted_key });
        setP(uri);
      } catch {
        // Onboarding swallows this silently, which makes a failed upload look
        // identical to a successful one. A driver fixing a rejected document
        // has to know whether the retry actually landed.
        setError("That upload did not go through. Please try again.");
      }
    },
    [doc.document_type, uploadFile],
  );

  const handlePick = useCallback(
    (uri: string) => pickInto(uri, setFile, setPreview),
    [pickInto],
  );
  const handlePickBack = useCallback(
    (uri: string) => pickInto(uri, setBackFile, setBackPreview),
    [pickInto],
  );

  const submit = useCallback(async () => {
    if (!file) return;
    setError(null);
    try {
      if (doc.kind === "PHOTO") {
        await savePhoto.mutateAsync({
          photo_id: file.id,
          photo_nonce: file.nonce,
          photo_encrypted_key: file.encrypted_key,
        });
      } else if (isIdentity) {
        if (!backFile) return;
        await saveIdentity.mutateAsync({
          id_type: doc.document_type,
          id_number: idNumber.trim(),
          file_id_front: file.id,
          front_nonce: file.nonce,
          front_encrypted_key: file.encrypted_key,
          file_id_back: backFile.id,
          back_nonce: backFile.nonce,
          back_encrypted_key: backFile.encrypted_key,
        } as any);
      } else {
        await saveDocument.mutateAsync({
          ...file,
          expiry: needsExpiry ? expiry : "",
          document_type: doc.document_type,
        });
      }
      // Flip the row to "under review" before the refetch lands, so the driver
      // never sees "Rejected" on a document they just replaced.
      markSubmitted(doc.document_type);
      onClose();
    } catch {
      setError("We could not submit that document. Please try again.");
    }
  }, [
    backFile,
    doc.kind,
    doc.document_type,
    expiry,
    file,
    idNumber,
    isIdentity,
    markSubmitted,
    needsExpiry,
    onClose,
    saveDocument,
    saveIdentity,
    savePhoto,
  ]);

  const busy =
    isUploading ||
    saveDocument.isPending ||
    saveIdentity.isPending ||
    savePhoto.isPending;
  const canSubmit =
    !!file &&
    (!needsExpiry || !!expiry.trim()) &&
    (!isIdentity || (!!backFile && !!idNumber.trim())) &&
    !busy;

  return (
    <Modal
      visible
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      {/* A Modal renders in its own native hierarchy, outside the app's
          GestureHandlerRootView, so every gesture-handler control inside it —
          which is every `pressto` button here, including the close X — receives
          no touches until the content is given a root of its own. */}
      <GestureHandlerRootView style={s.flex1}>
        {/* A non-transparent Modal paints the system background, which is white
            in this dark app — the sheet has to set its own. */}
        <RnView
          style={[
            s.flex1,
            s.px16,
            {
              backgroundColor: colors.background,
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <RnView style={[s.flexDirectionRow, s.justifyBetween, s.alignCenter]}>
            <RnText
              style={[atoms.text_lg, { fontFamily: fonts.medium.fontFamily }]}
            >
              {doc.label}
            </RnText>
            <Pressable onPress={onClose} hitSlop={12}>
              <Icon name="X" color={colors.text} size={24} />
            </Pressable>
          </RnView>

          <RnView style={[{ gap: 12, marginTop: 16 }]}>
            {needsExpiry && (
              <>
                <RnText style={[atoms.text_sm]}>
                  Expiry date
                  <RnText style={{ color: colors.notification }}>*</RnText>
                </RnText>
                <DateInputField
                  inputRef={dateRef}
                  value={expiry}
                  minimumDate={new Date()}
                  onChangeDate={(d: string) => setExpiry(toSimpleDateString(d))}
                  label="Expiry date"
                />
              </>
            )}

            {isIdentity && (
              <>
                <RnText style={[atoms.text_sm]}>
                  ID number
                  <RnText style={{ color: colors.notification }}>*</RnText>
                </RnText>
                <RnTextInput
                  style={[
                    s.input,
                    s.f16,
                    s.w100pct,
                    {
                      paddingLeft: 16,
                      fontFamily: fonts.regular.fontFamily,
                      color: colors.text,
                      borderColor: colors.lightBackground,
                    },
                  ]}
                  autoCorrect={false}
                  cursorColor={colors.lightBackground}
                  inputMode="numeric"
                  maxLength={12}
                  onChangeText={setIdNumber}
                  placeholder="289500000"
                  placeholderTextColor={colors.lightGray}
                  value={idNumber}
                />
              </>
            )}

            <ImagePickerFormController
              value={preview}
              label={
                isIdentity
                  ? "Front of document"
                  : doc.kind === "PHOTO"
                    ? "Your photo"
                    : "Document photo"
              }
              onChange={handlePick}
              isUploading={isUploading}
            />

            {isIdentity && (
              <ImagePickerFormController
                value={backPreview}
                label="Back of document"
                onChange={handlePickBack}
                isUploading={isUploading}
              />
            )}

            {error && (
              <RnText style={[atoms.text_2xs, { color: colors.danger }]}>
                {error}
              </RnText>
            )}
          </RnView>

          <RnView style={[s.flex1]} />

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[
              s.w100pct,
              s.py12,
              atoms.rounded_md,
              s.alignCenter,
              {
                backgroundColor: canSubmit
                  ? colors.primary
                  : colors.disabled_bg,
              },
            ]}
          >
            <RnText
              style={[
                atoms.text_sm,
                {
                  color: canSubmit ? colors.background : colors.disabledText,
                  fontFamily: fonts.medium.fontFamily,
                },
              ]}
            >
              {busy ? "Submitting…" : "Submit for review"}
            </RnText>
          </Pressable>
        </RnView>
      </GestureHandlerRootView>
    </Modal>
  );
});
