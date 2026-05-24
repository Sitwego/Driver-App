import { Image, ImageProps, ImageSourcePropType, View } from "react-native";

type RawSource =
  | string
  | number
  | { uri?: string; url?: string; path?: string }
  | null
  | undefined;

function normalizeSource(source: RawSource): ImageSourcePropType | undefined {
  if (source == null) return undefined;
  if (typeof source === "number") return source;
  if (typeof source === "string") {
    const trimmed = source.trim();
    return trimmed ? { uri: trimmed } : undefined;
  }
  if (typeof source === "object") {
    const s = source as Record<string, unknown>;
    const uri = ((s.uri ?? s.url ?? s.path) as string | undefined)?.trim();
    return uri ? { uri } : undefined;
  }
  return undefined;
}

interface HDRnImageProps extends Omit<ImageProps, "source"> {
  source?: RawSource;
}

export function HDRnImage({ source, style, ...props }: HDRnImageProps) {
  const safeSource = normalizeSource(source);
  if (!safeSource) return <View style={style} />;
  return <Image source={safeSource} style={style} {...props} />;
}
