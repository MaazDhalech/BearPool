import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HEADLINES = [
  "Cal's Biggest Rideshare Board",
  "Split any ride, split the cost",
  "Verified Cal students only",
  "Post a trip. Find your crew.",
];

const HEADLINE_INTERVAL_MS = 3200;
const FADE_MS = 350;

const palette = {
  accent: ACCENT,
  ink: darkTheme.textPrimary,
  muted: darkTheme.textSecondary,
  ghost: darkTheme.textGhost,
};

function RotatingHeadline() {
  const [index, setIndex] = React.useState(0);
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(() => {
        setIndex((i) => (i + 1) % HEADLINES.length);
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_MS,
          useNativeDriver: true,
        }).start();
      });
    }, HEADLINE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [opacity]);

  return (
    <Animated.Text style={[s.headline, { opacity }]}>
      {HEADLINES[index]}
    </Animated.Text>
  );
}

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const player = useVideoPlayer(
    require("../../assets/videos/welcome.mp4"),
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    },
  );

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View style={s.root}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          pointerEvents="none"
        />

        {/* Darken the footage so foreground text/buttons stay legible */}
        <View style={[StyleSheet.absoluteFill, s.scrim]} pointerEvents="none" />
        <LinearGradient
          colors={["rgba(0,0,0,0.75)", "transparent"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220 }}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.9)"]}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 340 }}
          pointerEvents="none"
        />

        <View
          style={[
            s.content,
            { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 24) },
          ]}
        >
          {/* Header */}
          <View style={s.header}>
            <Image
              source={require("../../assets/images/newicon.png")}
              style={s.logo}
              resizeMode="contain"
            />
            <Text style={s.brand}>BearPool</Text>
          </View>

          {/* Rotating headline */}
          <View style={s.headlineWrap}>
            <RotatingHeadline />
          </View>

          {/* CTAs */}
          <View style={s.ctas}>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/Login")}
              activeOpacity={0.85}
              style={s.primaryCta}
            >
              <Text style={s.primaryCtaLabel}>Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/Signup")}
              activeOpacity={0.85}
              style={s.secondaryCta}
            >
              <Text style={s.secondaryCtaLabel}>Sign Up</Text>
            </TouchableOpacity>

            <Text style={s.legalText}>
              By signing up, you agree to our{" "}
              <Text
                style={s.legalLink}
                onPress={() => router.push("/(stack)/settings/privacy-policy")}
              >
                Privacy Policy
              </Text>{" "}
              and{" "}
              <Text
                style={s.legalLink}
                onPress={() => router.push("/(stack)/settings/terms-of-service")}
              >
                Terms of Service
              </Text>
              .
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrim: {
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    marginBottom: 10,
  },
  brand: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  headlineWrap: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  headline: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 38,
  },
  ctas: {
    gap: 12,
  },
  primaryCta: {
    backgroundColor: palette.accent,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCtaLabel: {
    color: "#111",
    fontSize: 18,
    fontWeight: "700",
  },
  secondaryCta: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  secondaryCtaLabel: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  legalText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
  legalLink: {
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
