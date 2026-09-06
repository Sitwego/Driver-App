import { Galeria } from "@nandorojo/galeria";
import { Directory, File, Paths } from "expo-file-system";
import { memo, useEffect, useState } from "react";

/**
 * One image the viewer can open. `headers` is for images behind auth — the
 * driver's own documents are served from an authenticated endpoint, and neither
 * the native viewer nor react-native's `Image` can attach headers.
 */
export type ViewerSource = {
  uri: string;
  headers?: Record<string, string>;
};

/**
 * Full-screen image viewer: tap the child to open, pinch and swipe to dismiss.
 *
 * Wraps `@nandorojo/galeria`. Two constraints shape this component:
 *
 * 1. Galeria renders natively and cannot send request headers, so anything with
 *    `headers` is downloaded to the cache first and used as a local file.
 * 2. On Android the child must be a plain react-native `Image`. With
 *    `expo-image` the thumbnail still draws but the full-screen view opens
 *    black, because Galeria reads the child's bitmap to present.
 *
 * Both are why `children` is a function: it receives the URLs that are actually
 * safe to render, and a URL is `undefined` until its download finishes so the
 * caller can show a placeholder rather than a broken image.
 *
 * ```tsx
 * <ImageViewer sources={[{ uri, headers }]}>
 *   {([url]) =>
 *     url ? (
 *       <ImageViewer.Image index={0}>
 *         <Image source={{ uri: url }} style={thumb} />
 *       </ImageViewer.Image>
 *     ) : (
 *       <Placeholder />
 *     )
 *   }
 * </ImageViewer>
 * ```
 */
const ImageViewerRoot = memo(function ImageViewer({
  sources,
  theme = "dark",
  children,
}: {
  sources: ViewerSource[];
  theme?: "dark" | "light";
  children: (urls: (string | undefined)[]) => React.ReactNode;
}) {
  const urls = useViewableUrls(sources);

  return (
    <Galeria
      // Galeria needs a string per source; a not-yet-downloaded protected image
      // falls back to its remote URL, which simply fails to load rather than
      // shifting every later index.
      urls={urls.map((u, i) => u ?? sources[i].uri)}
      theme={theme}
    >
      {children(urls)}
    </Galeria>
  );
});

/** `ImageViewer.Image` marks which child opens which index. */
export const ImageViewer = Object.assign(ImageViewerRoot, {
  Image: Galeria.Image,
});

/**
 * Resolve sources to URLs that can be rendered without headers.
 *
 * Public URLs pass through untouched. Protected ones are `undefined` until
 * their download lands, then become a `file://` path.
 */
function useViewableUrls(sources: ViewerSource[]): (string | undefined)[] {
  const [resolved, setResolved] = useState<Record<string, string>>({});

  // The identity of `sources` changes on every render, so the effect keys off
  // the URLs themselves; re-downloading on each parent re-render would hammer
  // the endpoint.
  const key = sources.map((s) => s.uri).join("|");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      for (const source of sources) {
        if (!source.headers || !source.uri) continue;
        try {
          const local = await cacheProtectedImage(source);
          if (cancelled) return;
          setResolved((prev) =>
            prev[source.uri] === local
              ? prev
              : { ...prev, [source.uri]: local },
          );
        } catch {
          // Leave it unresolved; the caller shows its placeholder.
        }
      }
    }
    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return sources.map((s) => (s.headers ? resolved[s.uri] : s.uri));
}

const CACHE_DIR = "protected-images";

/**
 * Download an authenticated image into the cache directory and return its
 * local URI, reusing the file if it is already there.
 *
 * Reuse is safe because these URLs address an immutable version: a document
 * that changes gets a new row id and therefore a new URL, so a stale file can
 * never be shown for a newer version.
 */
async function cacheProtectedImage(source: ViewerSource): Promise<string> {
  const dir = new Directory(Paths.cache, CACHE_DIR);
  if (!dir.exists) dir.create({ intermediates: true });

  const target = new File(dir, fileNameFor(source.uri));
  if (target.exists) return target.uri;

  const file = await File.downloadFileAsync(source.uri, target, {
    headers: source.headers,
  });
  return file.uri;
}

/** A filesystem-safe, stable name for a URL. */
function fileNameFor(uri: string): string {
  let hash = 5381;
  for (let i = 0; i < uri.length; i++) {
    hash = ((hash << 5) + hash + uri.charCodeAt(i)) | 0;
  }
  return `img-${(hash >>> 0).toString(36)}.jpg`;
}
