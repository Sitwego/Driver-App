import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import Icon from "~/components/Icons";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { NavigationProps } from "~/navigation/types";
import { Pressable, StyleSheet } from "react-native";
import { themes } from "~/ui/theme/theme_utils";
import { useState } from "react";

const FAQ_ITEMS = [
  {
    question: "How do I get more ride requests?",
    answer:
      "Stay in high-demand areas, keep your acceptance rate high, and make sure your radius settings are optimised. Peak hours (morning and evening) tend to have more requests.",
  },
  {
    question: "How are earnings calculated?",
    answer:
      "Your earnings are based on the distance and duration of each trip, minus the platform fee. You can view a full breakdown in the Earnings tab.",
  },
  {
    question: "What should I do if a rider cancels?",
    answer:
      "If a rider cancels after you have already started heading to the pickup, you may be eligible for a cancellation fee. This is applied automatically.",
  },
  {
    question: "How do I update my vehicle information?",
    answer:
      "Go to Account → About Me → Vehicle & Categories to update your vehicle details and service categories.",
  },
  {
    question: "How do I contact support?",
    answer:
      "You can reach our support team via the button below. We aim to respond within 24 hours.",
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const { colors, fonts } = useAppTheme();
  const [open, setOpen] = useState(false);

  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      style={[
        s.py16,
        {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: themes.bg_800,
        },
      ]}
    >
      <RnView style={[s.flexDirectionRow, s.justifyBetween, s.alignCenter]}>
        <RnText
          style={[
            atoms.text_sm,
            {
              fontFamily: fonts.bold.fontFamily,
              flexShrink: 1,
              marginRight: 8,
            },
          ]}
        >
          {question}
        </RnText>
        <Icon
          name={open ? "ChevronUp" : "ChevronDown"}
          size={18}
          color={colors.lightGray}
          strokeWidth={2}
        />
      </RnView>
      {open && (
        <RnText
          style={[
            atoms.text_sm,
            {
              color: colors.lightGray,
              marginTop: 8,
              fontFamily: fonts.regular.fontFamily,
              lineHeight: 20,
            },
          ]}
        >
          {answer}
        </RnText>
      )}
    </Pressable>
  );
}

export function HelpScreen({ navigation }: NavigationProps<"HelpScreen">) {
  const { colors, fonts } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        s.px16,
        s.py16,
        { paddingBottom: insets.bottom + 32 },
      ]}
    >
      <RnView style={[s.flexDirectionRow, s.alignCenter, s.gap12, s.mb20]}>
        <RnView
          style={[
            s.alignCenter,
            s.justifyCenter,
            {
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: colors.lightBackground,
            },
          ]}
        >
          <Icon
            name="Headset"
            size={24}
            color={colors.primary}
            strokeWidth={1.5}
          />
        </RnView>
        <RnView>
          <RnText
            style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
          >
            Help & Support
          </RnText>
          <RnText style={[atoms.text_xs, { color: colors.lightGray }]}>
            Answers and ways to reach us
          </RnText>
        </RnView>
      </RnView>

      <RnText
        style={[
          atoms.text_xs,
          {
            color: colors.lightGray,
            fontFamily: fonts.bold.fontFamily,
            letterSpacing: 0.8,
            marginBottom: 4,
            textTransform: "uppercase",
          },
        ]}
      >
        Frequently Asked Questions
      </RnText>

      {FAQ_ITEMS.map((item, i) => (
        <FaqItem key={i} question={item.question} answer={item.answer} />
      ))}

      <Pressable
        style={[
          s.flexDirectionRow,
          s.alignCenter,
          s.gap12,
          s.p16,
          s.borderRadius_sm,
          s.mt24,
          { backgroundColor: colors.primary },
        ]}
      >
        <Icon name="MessageCircle" size={20} color="#fff" strokeWidth={1.5} />
        <RnText
          style={[
            atoms.text_sm,
            { color: "#fff", fontFamily: fonts.heavy.fontFamily },
          ]}
        >
          Contact support
        </RnText>
      </Pressable>
    </ScrollView>
  );
}
