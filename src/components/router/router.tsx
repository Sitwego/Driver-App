import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { SystemBars } from "react-native-edge-to-edge";

import PermissionsDisclosureModal from "~/components/PermissionsDisclosureModal";
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
  const [status, requestPermission] = Location.useForegroundPermissions();
  // Background permissions are needed, as app does use background location updates.
  const [, requestBgPermission] = Location.useBackgroundPermissions();

  // null = not yet known, true = show modal, false = hide modal.
  // Set once when status is first available — live status changes during the flow
  // must not collapse the modal while the user is mid-flow.
  const [showDisclosure, setShowDisclosure] = useState<boolean | null>(null);

  useEffect(() => {
    if (showDisclosure !== null || status == null) return;
    setShowDisclosure(!status.granted);
  }, [status, showDisclosure]);

  const handleForegroundRequest = async () => {
    await requestPermission();
  };

  const handleRequestBackground = async () => {
    await requestBgPermission();
    setShowDisclosure(false);
  };

  const handleSkipBackground = () => {
    setShowDisclosure(false);
  };

  return (
    <>
      <RouterNavigation>
        <SystemBars style={"light"} />
        <SubscriptionProvider>
          <BottomTabInner />
        </SubscriptionProvider>
      </RouterNavigation>
      <PermissionsDisclosureModal
        visible={showDisclosure === true}
        onForegroundRequest={handleForegroundRequest}
        onRequestBackground={handleRequestBackground}
        onSkipBackground={handleSkipBackground}
      />
    </>
  );
}
