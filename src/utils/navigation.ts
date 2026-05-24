// Interface for coordinates
interface Coordinates {
  lat: number;
  lng: number;
}

// Function to generate a Google Maps navigation link
export const generateGoogleMapsNavigationLink = (
  destination: Coordinates,
  options?: {
    travelMode?: "d" | "w" | "b" | "l";
  },
): string => {
  const baseUrl = "google.navigation:";
  const travelMode = options?.travelMode ?? "d";
  const destinationStr = `${destination.lat},${destination.lng}`;

  const queryParams = new URLSearchParams({
    q: destinationStr,
    mode: travelMode,
  });

  return `${baseUrl}?${queryParams.toString()}`;
};
