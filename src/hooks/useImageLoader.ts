import { useCallback, useEffect, useMemo, useState } from "react";
import { useImage } from "expo-image"; // For preloading
import { createProfileImageUrl } from "~/utils/url";
import { useUserState } from "~/lib/state/userState";

interface UseImageLoaderReturn {
  isLoading: boolean;
  isError: boolean;
  onLoad: () => void;
  uri: string;
}

export const useImageLoader = (): UseImageLoaderReturn => {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const state = useUserState();

  const uri = useMemo(
    () =>
      createProfileImageUrl(
        state.profile_id,
        state.photo_id || "",
        "get-profile-image",
      ),
    [state.profile_id, state.photo_id],
  );

  // Preload the image using ExpoImage's useImage hook
  const image = useImage(uri, { maxWidth: 80 });

  const onLoad = useCallback(() => {
    // Your custom onLoad logic
    console.log("Image ready for render");
  }, []);

  useEffect(() => {
    if (image) {
      onLoad(); // Trigger after preload
    }
  }, [image, onLoad]);

  return { isLoading, isError, onLoad, uri };
};
