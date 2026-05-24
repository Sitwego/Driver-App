/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import { AccountMenuScreen } from "~/Screens/AccountMenuScreen";
import { nativeStackNavigationWithAuth } from "~/navigation/nativeStackNavigationWithAuth";
import PlansScreen from "~/Screens/PlansScreen";
import PaymentScreen from "~/Screens/PaymentScreen";
import { SubscriptionOverviewScreen } from "~/Screens/SubscriptionOverviewScreen";
import { SubscriptionPlanDetailsScreen } from "~/Screens/SubscriptionPlanDetailsScreen";
import { SubscriptionActiveManagementScreen } from "~/Screens/SubscriptionActiveManagementScreen";
export const stack = nativeStackNavigationWithAuth();
export type Stack = typeof stack;
export function sharedStackScreens(Stack: Stack): React.JSX.Element {
  return (
    <>
      <Stack.Screen
        options={{ headerShown: true }}
        name="RideScreen"
        getComponent={() => require("~/Screens/RideScreen").RideScreen}
      />
      <Stack.Screen
        options={{ headerShown: true, title: "Confirm Payment" }}
        name="CollectCashAndConfirmRideEnded"
        getComponent={() =>
          require("~/Screens/CollectCashAndConfirmRideEnded")
            .CollectCashAndConfirmRideEnded
        }
      />
      <Stack.Screen
        options={{ headerShown: false }}
        name="AccountMenuScreen"
        component={AccountMenuScreen}
      />

      <Stack.Screen
        component={PlansScreen}
        name="Plans"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        options={{ headerShown: true, title: "Public Profile" }}
        name="DriverProfile"
        getComponent={() => require("~/Screens/DriverProfile").DriverProfile}
      />
      <Stack.Screen
        options={{ headerShown: true, title: "Edit Profile Picture" }}
        name="EditProfilePicture"
        getComponent={() =>
          require("~/Screens/EditProfilePicture").EditProfilePicture
        }
      />
      <Stack.Screen
        options={{ headerShown: true, title: "Edit Personal Details" }}
        name="EditPersonalDetails"
        getComponent={() =>
          require("~/Screens/EditPersonalDetails").EditPersonalDetails
        }
      />
      <Stack.Screen
        options={{ headerShown: true, title: "Add Bio" }}
        name="AddBio"
        getComponent={() => require("~/Screens/AddBio").AddBioScreen}
      />
      <Stack.Screen
        options={{ headerShown: true, title: "Travel Preferences" }}
        name="AddTravelPreferences"
        getComponent={() =>
          require("~/Screens/AddTravelPreferences").TravelPreferencesScreen
        }
      />
      <Stack.Screen
        name="VehicleAndCategoriesScreen"
        options={{ headerShown: true, title: "Vehicles" }}
        getComponent={() =>
          require("~/Screens/VehicleAndCategories").VehicleAndCategoriesScreen
        }
      />
      <Stack.Screen
        name="PayOut"
        options={{ title: "Mpesa Deposit", headerShown: true }}
        getComponent={() => require("~/Screens/PayOutScreen").PayOutScreen}
      />
      <Stack.Screen
        options={{}}
        name="RatingScreen"
        component={require("~/Screens/RatingScreen").RatingScreen}
      />
      <Stack.Screen
        options={{ headerShown: true, title: "Ratings" }}
        name="RatingOverview"
        getComponent={() =>
          require("~/Screens/RatingOverview").RatingOverviewScreen
        }
      />
      <Stack.Screen
        options={{ headerShown: true, title: "All Reviews" }}
        name="AllReviews"
        getComponent={() =>
          require("~/Screens/AllReviewsScreen").AllReviewsScreen
        }
      />
      <Stack.Screen
        name="SubscriptionOverview"
        component={SubscriptionOverviewScreen}
        options={{ headerShown: true, title: "Subscription Plans" }}
      />
      <Stack.Screen
        name="SubscriptionPlanDetails"
        component={SubscriptionPlanDetailsScreen}
        options={{ headerShown: true, title: "Plan Details" }}
      />
      <Stack.Screen
        name="SubscriptionActiveManagement"
        component={SubscriptionActiveManagementScreen}
        options={{ headerShown: true, title: "Manage Subscription" }}
      />

      <Stack.Screen
        options={{ headerShown: true, title: "Navigation & Sounds" }}
        name="NavigationAndSoundsScreen"
        getComponent={() =>
          require("~/Screens/NavigationAndSoundsScreen")
            .NavigationAndSoundsScreen
        }
      />
      <Stack.Screen
        options={{ headerShown: true, title: "Radius Settings" }}
        name="RadiusSettingsScreen"
        getComponent={() =>
          require("~/Screens/RadiusSettingsScreen").RadiusSettingsScreen
        }
      />
      <Stack.Screen
        options={{ headerShown: true, title: "Security Center" }}
        name="SecurityCenterScreen"
        getComponent={() =>
          require("~/Screens/SecurityCenterScreen").SecurityCenterScreen
        }
      />
      <Stack.Screen
        options={{ headerShown: true, title: "Help & Support" }}
        name="HelpScreen"
        getComponent={() => require("~/Screens/HelpScreen").HelpScreen}
      />
      <Stack.Screen
        options={{ headerShown: true, title: "About" }}
        name="AboutScreen"
        getComponent={() => require("~/Screens/AboutScreen").AboutScreen}
      />

      <Stack.Group
        screenOptions={{
          headerShown: false,
          sheetAllowedDetents: [1.0],
          presentation: "formSheet",
          sheetElevation: 24,
          animation: "slide_from_bottom",
          // unstable_sheetFooter: () => null,
        }}
      >
        <Stack.Screen options={{}} name="Payment" component={PaymentScreen} />
        <Stack.Screen
          options={{}}
          name="PreferencesOptions"
          getComponent={() =>
            require("~/Screens/Preferences").PreferencesScreen
          }
        />
      </Stack.Group>
    </>
  );
}
