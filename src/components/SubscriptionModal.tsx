import React, { forwardRef, useCallback, useImperativeHandle } from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  ActiveSubscription,
  RootStackNavigationType,
  SubscriptionCategory,
} from "~/navigation/types";

interface Props {
  children: React.ReactNode;
  category?: SubscriptionCategory;
  activeSub?: ActiveSubscription;
}

export type SubProps = {
  open: () => void;
  close: () => void;
};

export const SubscriptionPlansModal = forwardRef<SubProps, Props>(
  ({ children, category = "Taxi", activeSub }, ref) => {
    const navigation =
      useNavigation<NativeStackNavigationProp<RootStackNavigationType>>();

    const _onOpen = useCallback(() => {
      navigation.navigate("SubscriptionOverview", { category, activeSub });
    }, [navigation, category, activeSub]);

    const _onClose = useCallback(() => {
      navigation.goBack();
    }, [navigation]);

    useImperativeHandle(ref, () => ({
      open: _onOpen,
      close: _onClose,
    }));

    return <>{children}</>;
  },
);

SubscriptionPlansModal.displayName = "SubscriptionPlansModal";
