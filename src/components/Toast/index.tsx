import React, { JSX } from "react";
import { toast as sonner, Toaster, ToastProps } from "sonner-native";

import { s } from "~/styles/Common-Styles";
import { RnView } from "../RnView";
import RnText from "../RnText";
import { themes } from "~/ui/theme/theme_utils";
import { atoms } from "~/ui/theme/atoms";
import Icon from "../Icons";

export type ToastType = "default" | "success" | "error" | "warning" | "info";

export const DURATION = 3000;

/**
 * Toast are rendered on global level using sonner-native, placed in the root layout.
 * This component is just a wrapper around the Toaster component from sonner-native.
 * @returns {JSX.Element}
 */
export function ToastComponent(): JSX.Element {
  return <Toaster pauseWhenPageIsHidden gap={s.gap12.gap} />;
}

/**
 * Exporting the toast API from sonner-native for use in the application.
 */
export const toastApi = sonner;

export type { ToastProps } from "sonner-native";

/**
 * Base toast function to show a toast message.
 * @param content - The content of the toast message.
 * @param options - Optional toast properties.
 * @param Icon - Optional icon to display in the toast.
 */

export function showToast(
  content: React.ReactNode,
  options?: ToastProps,
  Icon?: JSX.Element,
): void {
  const id = generateUUID();

  if (typeof content === "string") {
    sonner.custom(
      <RnView
        style={[
          s.w100pct,
          s.flexDirectionRow,
          s.gap8,
          s.py20,
          s.px10,
          s.borderRadius_sm,
          { backgroundColor: themes.bg_900 },
        ]}
      >
        {Icon}
        <RnText style={[atoms.text_sm]} selectable={false}>
          {content}
        </RnText>
      </RnView>,
      { ...options, id, duration: options?.duration ?? DURATION },
    );
  } else if (React.isValidElement(content)) {
    sonner.custom(<React.Fragment>{content}</React.Fragment>, {
      ...options,
      id,
      duration: options?.duration ?? DURATION,
    });
  }
}

export function showSuccessToast(message: string, options?: ToastProps): void {
  const id = generateUUID();
  sonner.custom(
    <RnView
      style={[
        s.w100pct,
        s.flexDirectionRow,
        s.alignCenter,
        s.gap8,
        s.py16,
        s.px10,
        s.borderRadius_sm,
        {
          backgroundColor: themes.green_950,
          borderWidth: 1,
          borderColor: themes.green_800,
        },
      ]}
    >
      <RnView
        style={[
          s.alignCenter,
          s.justifyCenter,
          {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: themes.green_800,
          },
        ]}
      >
        <Icon name="Check" size={18} color={themes.green_300} strokeWidth={2.5} />
      </RnView>
      <RnView style={[s.flex1]}>
        <RnText
          style={[
            atoms.text_sm,
            { color: themes.green_200, fontWeight: "600" },
          ]}
          selectable={false}
        >
          {message}
        </RnText>
      </RnView>
    </RnView>,
    { ...options, id, duration: options?.duration ?? DURATION },
  );
}

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
