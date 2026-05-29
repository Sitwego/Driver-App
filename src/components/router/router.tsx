import { SystemBars } from "react-native-edge-to-edge";

import { useGetPushToken } from "~/hooks/useRequestPushNotifPermisions";
import { SubscriptionProvider } from "~/lib/Providers/SubscriptionProvider";
import { RouterNavigation } from "~/navigation/navigation";

import { TabsNavigator } from "./Bottom-Tabs/bottom-tabs";

const BottomTabInner = () => {
  return (
    <>
      <TabsNavigator />
    </>
  );
};

export default function RootRouter() {
  useGetPushToken();

  return (
    <RouterNavigation>
      <SystemBars style={"light"} />
      <SubscriptionProvider>
        <BottomTabInner />
      </SubscriptionProvider>
    </RouterNavigation>
  );
}
