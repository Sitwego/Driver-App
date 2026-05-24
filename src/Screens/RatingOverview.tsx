import { View } from "react-native";
import { RatingSummary } from "~/components/RatingSummary";
import { NavigationProps } from "~/navigation/types";
import { useDriverRatingOverview } from "~/hooks/apis";
import { useUserState } from "~/lib/state/userState";
import LoadingIndicator from "~/components/LoadingIndicator";

type Props = NavigationProps<"RatingOverview">;

export function RatingOverviewScreen({ navigation }: Props) {
  const driverState = useUserState();
  const driverId = driverState.profile_id!;
  const { data, isLoading } = useDriverRatingOverview(driverId);

  const handleShowMore = () => {
    navigation.navigate("AllReviews", { driverId });
  };

  if (isLoading || !data) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <LoadingIndicator />
      </View>
    );
  }

  return <RatingSummary data={data} onShowMore={handleShowMore} />;
}
