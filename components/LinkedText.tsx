import React, { useMemo } from "react";
import { Linking, Text, type StyleProp, type TextStyle } from "react-native";

/**
 * Auto-linkifies chat text: URLs, emails, phone numbers, and street addresses
 * become tappable. Zero dependencies — pure regex tokenizing.
 *
 *   url     -> opens in the browser
 *   email   -> mailto:
 *   phone   -> tel: dialer
 *   address -> Google Maps search
 */

export type LinkType = "url" | "email" | "phone" | "address";
export type Token = { start: number; end: number; type: LinkType; value: string };

const URL_RE = /\b(https?:\/\/|www\.)[^\s<]+/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// US-style 10-digit numbers, optional country code and separators.
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
// "<number> ... <street suffix>"
const ADDRESS_RE =
  /\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Square|Sq|Terrace|Ter|Highway|Hwy|Parkway|Pkwy)\b\.?/gi;

// Trailing characters that shouldn't be part of a link.
const TRAILING = /[.,!?;:)\]}>'"]+$/;

function collect(text: string, re: RegExp, type: LinkType, out: Token[]) {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let value = m[0];
    let end = m.index + value.length;
    if (type !== "address") {
      const trimmed = value.replace(TRAILING, "");
      end -= value.length - trimmed.length;
      value = trimmed;
    }
    if (value.length > 0) out.push({ start: m.index, end, type, value });
  }
}

export function findLinks(text: string): Token[] {
  const all: Token[] = [];
  collect(text, URL_RE, "url", all);
  collect(text, EMAIL_RE, "email", all);
  collect(text, ADDRESS_RE, "address", all);
  collect(text, PHONE_RE, "phone", all);

  // Earliest first, longer match wins on overlap.
  all.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const result: Token[] = [];
  let lastEnd = 0;
  for (const t of all) {
    if (t.start >= lastEnd) {
      result.push(t);
      lastEnd = t.end;
    }
  }
  return result;
}

function openToken(t: Token) {
  let url: string;
  switch (t.type) {
    case "email":
      url = `mailto:${t.value}`;
      break;
    case "phone":
      url = `tel:${t.value.replace(/[^\d+]/g, "")}`;
      break;
    case "address":
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.value)}`;
      break;
    default:
      url = /^https?:\/\//i.test(t.value) ? t.value : `https://${t.value}`;
  }
  Linking.openURL(url).catch(() => {});
}

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  linkColor: string;
};

export function LinkedText({ text, style, linkColor }: Props) {
  const tokens = useMemo(() => findLinks(text), [text]);

  if (tokens.length === 0) return <Text style={style}>{text}</Text>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  tokens.forEach((t, i) => {
    if (t.start > cursor) {
      parts.push(<Text key={`p${i}`}>{text.slice(cursor, t.start)}</Text>);
    }
    parts.push(
      <Text
        key={`l${i}`}
        style={{ color: linkColor, textDecorationLine: "underline" }}
        onPress={() => openToken(t)}
        suppressHighlighting
      >
        {text.slice(t.start, t.end)}
      </Text>,
    );
    cursor = t.end;
  });
  if (cursor < text.length) parts.push(<Text key="end">{text.slice(cursor)}</Text>);

  return <Text style={style}>{parts}</Text>;
}
