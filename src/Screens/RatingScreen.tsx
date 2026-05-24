import { RatingComponent } from "~/components/RatingComponent";
import { RatingScreenProps } from "~/navigation/types";

export function RatingScreen(props: RatingScreenProps): React.JSX.Element {
  return <RatingComponent {...props} />;
}
