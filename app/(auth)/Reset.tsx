import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
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
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ResetPassword = () => {
  const { signIn } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [activeStep, setActiveStep] = React.useState<"request" | "verify" | "reset">("request");

  const handleRequestReset = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email");
      return;
    }

    setLoading(true);
    try {
      await signIn?.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setActiveStep("verify");
    } catch (err: any) {
      Alert.alert("Error", err.errors?.[0]?.message || "Failed to send reset code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code) {
      Alert.alert("Error", "Please enter the verification code");
      return;
    }

    setLoading(true);
    try {
      const attempt = await signIn?.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
      });

      if (attempt?.status === "needs_new_password") {
        setActiveStep("reset");
      }
    } catch (err: any) {
      Alert.alert("Error", err.errors?.[0]?.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      Alert.alert("Error", "Please enter a new password");
      return;
    }

    setLoading(true);
    try {
      await signIn?.resetPassword({
        password: newPassword,
      });
      Alert.alert("Success", "Password reset successfully!");
      router.replace("/(auth)/Login");
    } catch (err: any) {
      Alert.alert("Error", err.errors?.[0]?.message || "Failed to reset password");
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
            <Text style={{ 
              color: "#ffffff", 
              fontSize: 28, 
              fontWeight: "600", 
              marginBottom: 30, 
              textAlign: "center" 
            }}>
              Reset Password
            </Text>

            {activeStep === "request" && (
              <>
                <Text style={{ 
                  color: "#a0a0a0", 
                  marginBottom: 24, 
                  textAlign: "center",
                  fontSize: 16
                }}>
                  Enter your email to receive a reset code
                </Text>
                
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
                    Email Address
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    value={email}
                    placeholder="your@email.com"
                    placeholderTextColor="#666"
                    onChangeText={setEmail}
                    style={{
                      backgroundColor: "#1e1e1e",
                      color: "#ffffff",
                      padding: 14,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#333",
                      fontSize: 16,
                    }}
                    keyboardType="email-address"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleRequestReset}
                  disabled={loading}
                  style={{
                    backgroundColor: "#3a7bd5",
                    padding: 16,
                    borderRadius: 8,
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  <Text style={{ 
                    color: "white", 
                    textAlign: "center", 
                    fontWeight: "600",
                    fontSize: 16,
                  }}>
                    {loading ? "Sending..." : "Send Reset Code"}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {activeStep === "verify" && (
              <>
                <Text style={{ 
                  color: "#a0a0a0", 
                  marginBottom: 24, 
                  textAlign: "center",
                  fontSize: 16
                }}>
                  Enter the verification code sent to {email}
                </Text>
                
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
                    Verification Code
                  </Text>
                  <TextInput
                    value={code}
                    placeholder="6-digit code"
                    placeholderTextColor="#666"
                    onChangeText={setCode}
                    style={{
                      backgroundColor: "#1e1e1e",
                      color: "#ffffff",
                      padding: 14,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#333",
                      fontSize: 16,
                    }}
                    keyboardType="number-pad"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleVerifyCode}
                  disabled={loading}
                  style={{
                    backgroundColor: "#3a7bd5",
                    padding: 16,
                    borderRadius: 8,
                    opacity: loading ? 0.7 : 1,
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ 
                    color: "white", 
                    textAlign: "center", 
                    fontWeight: "600",
                    fontSize: 16,
                  }}>
                    {loading ? "Verifying..." : "Verify Code"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleRequestReset}
                  style={{
                    padding: 16,
                  }}
                >
                  <Text style={{ 
                    color: "#3a7bd5", 
                    textAlign: "center", 
                    fontWeight: "500",
                    fontSize: 14,
                  }}>
                    Resend Code
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {activeStep === "reset" && (
              <>
                <Text style={{ 
                  color: "#a0a0a0", 
                  marginBottom: 24, 
                  textAlign: "center",
                  fontSize: 16
                }}>
                  Create a new password
                </Text>
                
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
                    New Password
                  </Text>
                  <TextInput
                    value={newPassword}
                    placeholder="Enter new password"
                    placeholderTextColor="#666"
                    secureTextEntry={true}
                    onChangeText={setNewPassword}
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
                  onPress={handleResetPassword}
                  disabled={loading}
                  style={{
                    backgroundColor: "#3a7bd5",
                    padding: 16,
                    borderRadius: 8,
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  <Text style={{ 
                    color: "white", 
                    textAlign: "center", 
                    fontWeight: "600",
                    fontSize: 16,
                  }}>
                    {loading ? "Resetting..." : "Reset Password"}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={() => router.replace("/(auth)/Login")}
              style={{
                padding: 16,
                marginTop: 20,
              }}
            >
              <Text style={{ 
                color: "#3a7bd5", 
                textAlign: "center", 
                fontWeight: "500",
                fontSize: 14,
              }}>
                Back to Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default ResetPassword;