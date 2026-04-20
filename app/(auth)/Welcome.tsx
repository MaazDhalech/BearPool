import { ACCENT } from "@/constants/Colors";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { Car, List, MessageCircle } from "lucide-react-native";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCALE = 0.9;

const palette = {
  bg: "#121212",
  surface: "#1e1e1e",
  rim: "#252525",
  accent: ACCENT,
  ink: "#ffffff",
  muted: "#a1a1a6",
  ghost: "#545456",
};

const FEATURES = [
  {
    Icon: Car,
    title: "Split a rideshare",
    body: "Post a trip and find Cal students to split the cost of any ride service.",
  },
  {
    Icon: List,
    title: "Browse the board",
    body: "See rides posted by other verified students and join one that fits your schedule.",
  },
  {
    Icon: MessageCircle,
    title: "Chat with your group",
    body: "Every ride has a group chat to coordinate pickup, timing, and cost splits.",
  },
];

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }]}>
        <LinearGradient
          colors={["rgba(255, 190, 92, 0.22)", "transparent"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}
          pointerEvents="none"
        />

        <View style={s.content}>
          {/* Header */}
          <View style={s.header}>
            <Image
              source={require("../../assets/images/newicon.png")}
              style={s.logo}
              resizeMode="contain"
            />
            <Text style={s.title}>Welcome to BearPool</Text>
            <Text style={s.subtitle}>You're now part of the biggest Cal ride-share board.</Text>
          </View>

          {/* Callout — clarify what BearPool is */}
          <View style={s.callout}>
            <Text style={s.calloutTitle}>BearPool is for splitting rides</Text>
            <Text style={s.calloutBody}>
              Coordinate any ride service with other verified Cal students — as of now, BearPool is not for carpooling in personal cars. Post a trip, find people heading the same way, and split the cost.
            </Text>
          </View>

          {/* Feature rows */}
          <View style={s.features}>
            {FEATURES.map(({ Icon, title, body }) => (
              <View key={title} style={s.featureRow}>
                <View style={s.iconWrap}>
                  <Icon size={20} color={palette.accent} strokeWidth={1.8} />
                </View>
                <View style={s.featureText}>
                  <Text style={s.featureTitle}>{title}</Text>
                  <Text style={s.featureBody}>{body}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={() => router.replace("/")}
            activeOpacity={0.8}
            style={s.cta}
          >
            <Text style={s.ctaLabel}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24 * SCALE,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 28 * SCALE,
  },
  logo: {
    width: 80 * SCALE,
    height: 80 * SCALE,
    borderRadius: 18 * SCALE,
    marginBottom: 16 * SCALE,
  },
  title: {
    color: palette.ink,
    fontSize: 30 * SCALE,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16 * SCALE,
    marginTop: 6 * SCALE,
    textAlign: "center",
  },
  callout: {
    backgroundColor: palette.surface,
    borderRadius: 12 * SCALE,
    borderWidth: 1,
    borderColor: palette.rim,
    padding: 16 * SCALE,
    marginBottom: 28 * SCALE,
  },
  calloutTitle: {
    color: palette.ink,
    fontSize: 14 * SCALE,
    fontWeight: "700",
    marginBottom: 6 * SCALE,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  calloutBody: {
    color: palette.muted,
    fontSize: 14 * SCALE,
    lineHeight: 21 * SCALE,
  },
  features: {
    gap: 18 * SCALE,
    marginBottom: 36 * SCALE,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14 * SCALE,
  },
  iconWrap: {
    width: 36 * SCALE,
    height: 36 * SCALE,
    borderRadius: 8 * SCALE,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.rim,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2 * SCALE,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    color: palette.ink,
    fontSize: 15 * SCALE,
    fontWeight: "600",
    marginBottom: 3 * SCALE,
  },
  featureBody: {
    color: palette.ghost,
    fontSize: 13 * SCALE,
    lineHeight: 19 * SCALE,
  },
  cta: {
    backgroundColor: palette.accent,
    height: 56 * SCALE,
    borderRadius: 12 * SCALE,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaLabel: {
    color: palette.bg,
    fontSize: 18 * SCALE,
    fontWeight: "700",
  },
});
