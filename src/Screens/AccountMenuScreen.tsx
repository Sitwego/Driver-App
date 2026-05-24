import React, { memo, useCallback, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pager, PagerRef } from "~/components/Page/Pager";
import { PageTabBar } from "~/components/Page/PagerHeader";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { AboutDriver } from "~/ui/Views/AboutDriver";
import { AccountSettings } from "~/ui/Views/AccountSettings";

export const AccountMenuScreen: React.FC<any> = memo(({ navigation }: any) => {
  const pagerRef = React.useRef<PagerRef>(null);
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const inset = useSafeAreaInsets();

  const onSelectedTab = useCallback((index: number) => {
    setSelectedTab(index);
  }, []);

  const renderTabBar = useCallback((props: any) => {
    return <PageTabBar {...props} items={["About Me", "Account"]} />;
  }, []);
  return (
    <RnView style={[{ paddingTop: inset.top }, s.flex1]}>
      <Pager
        ref={pagerRef}
        testID="homeScreen"
        onPageSelected={onSelectedTab}
        renderTabBar={renderTabBar}
        initialPage={selectedTab}
      >
        <AboutDriver navigation={navigation} />
        <AccountSettings navigation={navigation} />
      </Pager>
    </RnView>
  );
});

AccountMenuScreen.displayName = "AccountMenuScreen";
