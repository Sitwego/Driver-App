import { PressableScale as Pressable } from "pressto";
import { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, RefreshControl } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

import Icon from "~/components/Icons";
import { ImageViewer } from "~/components/ImageViewer";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import {
  useDocumentImageSource,
  useDriverDocuments,
} from "~/hooks/useDocumentsApi";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import {
  canUpload,
  documentKey,
  formatReviewDate,
  pendingReplacement,
  rejectedReplacement,
  rejectionMessage,
  resubmissionNotice,
  statusDisplay,
  uploadActionLabel,
  type DriverDocument,
} from "~/utils/documentStatus";
import { DOCUMENT_TYPE_LABELS } from "~/utils/documentTypes";

import { ResubmitSheet } from "./documents/ResubmitSheet";

/**
 * The driver's view of their onboarding documents.
 *
 * This screen exists because approval state was previously invisible in the
 * app: a document could be rejected and the driver would only find out by
 * noticing they could not go online. The onboarding flow that uploaded the
 * documents is unreachable once `hasOnboarded` is true, so a rejected driver
 * had no way back in at all.
 */
export const MyDocumentsScreen = memo(function MyDocumentsScreen() {
  const { colors } = useAppTheme();
  const { data, isLoading, isRefetching, refetch, error } =
    useDriverDocuments();
  const [active, setActive] = useState<DriverDocument | null>(null);

  const docs = useMemo(() => data ?? [], [data]);

  const onClose = useCallback(() => setActive(null), []);

  if (isLoading) {
    return (
      <RnView style={[s.flex1, s.justifyCenter, s.alignCenter]}>
        <ActivityIndicator color={colors.primary} />
      </RnView>
    );
  }

  if (error) {
    return (
      <RnView
        style={[s.flex1, s.justifyCenter, s.alignCenter, s.px16, s.gap12]}
      >
        <Icon name="CloudOff" color={colors.lightGray} size={32} />
        <RnText style={[atoms.text_sm, s.textCenter, { color: colors.text }]}>
          We could not load your documents. Pull down to try again.
        </RnText>
      </RnView>
    );
  }

  return (
    <>
      <ScrollView
        style={[s.flex1]}
        contentContainerStyle={[s.px16, { paddingVertical: 16, gap: 12 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        <RnText style={[atoms.text_xs, { color: colors.lightGray }]}>
          Documents are checked by our team. You will see the result here.
        </RnText>

        {docs.map((doc) => (
          <DocumentRow
            key={documentKey(doc)}
            doc={doc}
            onPress={() => setActive(doc)}
          />
        ))}
        <RnView style={{ marginBottom: 120 }}></RnView>
      </ScrollView>

      {active && <ResubmitSheet doc={active} onClose={onClose} />}
    </>
  );
});

/**
 * A name to show if the server ever sends a row without a label. Only typed
 * documents have a client-side name; identity subtypes are server-named, so the
 * raw value is a better last resort than a blank row.
 */
function documentFallbackLabel(doc: DriverDocument): string {
  if (doc.kind === "DOCUMENT") {
    const known = DOCUMENT_TYPE_LABELS as Record<string, string | undefined>;
    return known[doc.document_type] ?? doc.document_type;
  }
  return doc.document_type;
}

/**
 * The document's own image, so the driver can tell at a glance which photo a
 * rejection is talking about — with several documents in the list, "the photo
 * was too blurry" is otherwise ambiguous.
 *
 * Falls back to a placeholder rather than an empty space: a failed image load
 * must not look like a missing document.
 */
const THUMB = { width: 56, height: 56 } as const;

const Thumbnail = memo(function Thumbnail({ doc }: { doc: DriverDocument }) {
  const { colors } = useAppTheme();
  const imageSource = useDocumentImageSource();
  const [failed, setFailed] = useState(false);

  // Identity documents are two-sided, so the viewer gets both pages and the
  // driver can swipe between them; everything else has a single image.
  const sources = useMemo(
    () =>
      [imageSource(doc, "front"), imageSource(doc, "back")].filter(
        (s): s is NonNullable<typeof s> => !!s,
      ),
    [imageSource, doc],
  );
  const source = sources[0];

  const box = [
    { ...THUMB, backgroundColor: colors.background },
    atoms.rounded_sm,
    s.alignCenter,
    s.justifyCenter,
  ];

  const placeholder = (icon: "ImagePlus" | "ImageOff" | "Image") => (
    <RnView style={box}>
      <Icon name={icon} color={colors.lightGray} size={20} />
    </RnView>
  );

  if (!source || failed) {
    return placeholder(
      doc.status === "NOT_SUBMITTED" ? "ImagePlus" : "ImageOff",
    );
  }

  return (
    <ImageViewer sources={sources}>
      {([url]) =>
        // Until the download lands there is nothing renderable: react-native's
        // Image cannot authenticate, and it has to be react-native's Image
        // because Galeria presents the child's bitmap.
        url ? (
          <ImageViewer.Image index={0}>
            <Image
              source={{ uri: url }}
              style={[THUMB, atoms.rounded_sm]}
              resizeMode="cover"
              onError={() => setFailed(true)}
            />
          </ImageViewer.Image>
        ) : (
          placeholder("Image")
        )
      }
    </ImageViewer>
  );
});

const DocumentRow = memo(function DocumentRow({
  doc,
  onPress,
}: {
  doc: DriverDocument;
  onPress: () => void;
}) {
  const { colors, fonts } = useAppTheme();
  const display = statusDisplay(doc.status);
  const reason = rejectionMessage(doc);
  const reviewedOn = formatReviewDate(doc.reviewed_at);
  const replacing = pendingReplacement(doc);
  const rejected = rejectedReplacement(doc);
  const uploadable = canUpload(doc);
  const frozen = resubmissionNotice(doc);

  // The palette has no amber, so "under review" borrows the primary colour —
  // it reads as in-progress and stays distinct from the grey of a document
  // never submitted.
  const tone = {
    success: colors.success,
    pending: colors.primary,
    danger: colors.danger,
    muted: colors.lightGray,
  }[display.tone];

  return (
    <RnView
      style={[
        s.w100pct,
        s.p16,
        atoms.rounded_md,
        { backgroundColor: colors.lightBackground, gap: 8 },
      ]}
    >
      <RnView style={[s.flexDirectionRow, s.gap12]}>
        <Thumbnail doc={doc} />
        <RnView style={[s.flex1, { gap: 4 }]}>
          <RnView style={[s.flexDirectionRow, s.justifyBetween, s.gap6]}>
            <RnView style={[s.flex1]}>
              <RnText
                style={[atoms.text_sm, { fontFamily: fonts.medium.fontFamily }]}
              >
                {doc.label || documentFallbackLabel(doc)}
                {!doc.required && (
                  <RnText style={[atoms.text_2xs, { color: colors.lightGray }]}>
                    {"  (optional)"}
                  </RnText>
                )}
              </RnText>
            </RnView>
            <RnView style={[s.flexDirectionRow, s.gap6, s.alignCenter]}>
              <Icon name={display.icon} color={tone} size={16} />
              <RnText style={[atoms.text_2xs, { color: tone }]}>
                {display.label}
              </RnText>
            </RnView>
          </RnView>
          {doc.expiry && doc.status === "APPROVED" && (
            <RnText style={[atoms.text_2xs, { color: colors.lightGray }]}>
              Expires {doc.expiry}
            </RnText>
          )}
        </RnView>
      </RnView>

      {/* An approved document whose renewal is queued. Without this the row
          looks untouched after a resubmission and the driver has no sign their
          upload landed. */}
      {replacing && (
        <RnText style={[atoms.text_2xs, { color: colors.lightGray }]}>
          New version under review — your approved document is still valid.
        </RnText>
      )}

      {/* An approved document has no upload button. Saying why keeps the row
          from reading as broken, and a driver holding a renewed licence needs
          to know the date rather than checking back daily. */}
      {frozen && (
        <RnText style={[atoms.text_2xs, { color: colors.lightGray }]}>
          {frozen}
        </RnText>
      )}

      {reason && (
        <RnView
          style={[
            s.p16,
            atoms.rounded_md,
            { backgroundColor: colors.background, gap: 4 },
          ]}
        >
          {/* Without this line an approved document whose replacement was
              rejected would show a bare rejection reason, reading as though
              the document they are relying on had been revoked. */}
          {rejected && (
            <RnText style={[atoms.text_2xs, { color: colors.text }]}>
              Your new version was not accepted. The document we already
              approved is still valid.
            </RnText>
          )}
          <RnText style={[atoms.text_2xs, { color: colors.danger }]}>
            {reason}
          </RnText>
          {/* `reviewed_at` belongs to the row that set the headline status, so
              it is not the replacement's review date — showing it there would
              date the message wrongly. */}
          {reviewedOn && !rejected && (
            <RnText style={[atoms.text_2xs, { color: colors.lightGray }]}>
              Reviewed {reviewedOn}
            </RnText>
          )}
        </RnView>
      )}

      {uploadable && (
        <Pressable
          onPress={onPress}
          style={[
            s.w100pct,
            s.py10,
            atoms.rounded_md,
            s.alignCenter,
            { backgroundColor: colors.primary },
          ]}
        >
          <RnText
            style={[
              atoms.text_sm,
              { color: colors.text, fontFamily: fonts.medium.fontFamily },
            ]}
          >
            {uploadActionLabel(doc)}
          </RnText>
        </Pressable>
      )}
    </RnView>
  );
});
