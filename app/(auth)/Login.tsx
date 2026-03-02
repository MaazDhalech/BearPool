import { useSignIn } from "@clerk/clerk-expo";
import { ACCENT } from "@/constants/Colors";
import { Link, useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Login() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const onSignInPress = async () => {
    if (!isLoaded) return;
    setLoading(true);

    try {
      const signInAttempt = await signIn.create({
        identifier,
        password,
      });

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace("/");
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2));
        Alert.alert("Sign In Error", "Unable to complete sign in.");
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
      Alert.alert("Sign In Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#121212" }}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 20,
            paddingTop: insets.top + 20,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 28,
                fontWeight: "600",
                marginBottom: 30,
                textAlign: "center",
              }}
            >
              Welcome Back
            </Text>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
                Email or Username
              </Text>
              <TextInput
                autoCapitalize="none"
                value={identifier}
                placeholder="Enter email or username"
                placeholderTextColor="#666"
                onChangeText={setIdentifier}
                style={{
                  backgroundColor: "#1e1e1e",
                  color: "#ffffff",
                  padding: 14,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#333",
                  fontSize: 16,
                }}
              />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
                Password
              </Text>
              <TextInput
                value={password}
                placeholder="Enter password"
                placeholderTextColor="#666"
                secureTextEntry={true}
                onChangeText={setPassword}
                style={{
                  backgroundColor: "#1e1e1e",
                  color: "#ffffff",
                  padding: 14,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#333",
                  fontSize: 16,
                }}
              />
            </View>

            <TouchableOpacity
              onPress={onSignInPress}
              activeOpacity={0.8}
              disabled={loading}
              style={{
                backgroundColor: ACCENT,
                padding: 16,
                borderRadius: 8,
                opacity: loading ? 0.7 : 1,
                shadowColor: ACCENT,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Text
                style={{
                  color: "#121212",
                  textAlign: "center",
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                {loading ? "Signing in..." : "Continue"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/Reset")}
              style={{ padding: 16 }}
            >
              <Text
                style={{
                  color: ACCENT,
                  textAlign: "center",
                  fontWeight: "500",
                  fontSize: 14,
                }}
              >
                Forgot Password?
              </Text>
            </TouchableOpacity>

            <View
              style={{
                flexDirection: "row",
                marginTop: 16,
                justifyContent: "center",
                gap: 5,
              }}
            >
              <Text style={{ color: "#a0a0a0" }}>Don't have an account?</Text>
              <Link href="/(auth)/Signup" asChild>
                <TouchableOpacity>
                  <Text style={{ color: ACCENT, fontWeight: "500" }}>
                    Sign up
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}