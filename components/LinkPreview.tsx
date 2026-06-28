import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { useEffect, useState } from "react";
import {
  Image,
  Linking,
  type StyleProp,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";

/**
 * iMessage-style rich link preview. Fetches Open Graph metadata client-side
 * (RN fetch isn't CORS-bound), caches per-URL, and renders an image + title +
 * domain card. Falls back to the plain link when no metadata is available.
 */

type Meta = { title?: string; image?: string; site?: string };
const cache = new Map<string, Meta | null>();

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/gi, "'");
}

function metaTag(html: string, prop: string): string | undefined {
  const a = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const b = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i",
  );
  const m = html.match(a) || html.match(b);
  return m ? decode(m[1]) : undefined;
}

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function fetchMeta(url: string): Promise<Meta | null> {
  const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(full, { signal: controller.signal });
    clearTimeout(timer);
    const html = (await res.text()).slice(0, 200000);

    let image = metaTag(html, "og:image") || metaTag(html, "twitter:image");
    if (image && !/^https?:\/\//i.test(image)) {
      try {
        image = new URL(image, full).href;
      } catch {
        image = undefined;
      }
    }
    const title =
      metaTag(html, "og:title") ||
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    const site = metaTag(html, "og:site_name");

    const meta: Meta = { title: title ? decode(title) : undefined, image, site };
    return meta.image || meta.title ? meta : null;
  } catch {
    return null;
  }
}

export function LinkPreview({
  url,
  onlyLink,
  linkColor,
  style,
}: {
  url: string;
  onlyLink?: boolean;
  linkColor: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [meta, setMeta] = useState<Meta | null | undefined>(cache.get(url));
  const open = () =>
    Linking.openURL(/^https?:\/\//i.test(url) ? url : `https://${url}`).catch(() => {});

  useEffect(() => {
    if (cache.has(url)) {
      setMeta(cache.get(url));
      return;
    }
    let active = true;
    fetchMeta(url).then((m) => {
      cache.set(url, m);
      if (active) setMeta(m);
    });
    return () => {
      active = false;
    };
  }, [url]);

  // No (or not-yet-loaded) preview.
  if (!meta || (!meta.image && !meta.title)) {
    if (!onlyLink) return null; // text bubble already shows the link
    return (
      <Text
        onPress={open}
        suppressHighlighting
        style={{ color: linkColor, textDecorationLine: "underline", fontSize: TYPE.size.body }}
      >
        {url}
      </Text>
    );
  }

  return (
    <TouchableOpacity
      onPress={open}
      activeOpacity={0.85}
      style={[
        {
          width: 280,
          maxWidth: "100%",
          backgroundColor: "#1e1e1e",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#2a2a2a",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {meta.image ? (
        <Image
          source={{ uri: meta.image }}
          style={{ width: "100%", height: 180, backgroundColor: "#2a2a2a" }}
          resizeMode="cover"
        />
      ) : null}
      <View style={{ paddingHorizontal: SPACE.md, paddingVertical: SPACE.md, gap: 3 }}>
        <Text numberOfLines={1} style={{ color: "#888", fontSize: TYPE.size.label, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {meta.site || hostOf(url)}
        </Text>
        {meta.title ? (
          <Text numberOfLines={2} style={{ color: "#e8e8e8", fontSize: TYPE.size.body, fontWeight: "600", lineHeight: TYPE.size.body * 1.3 }}>
            {meta.title}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
