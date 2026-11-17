import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PeachBackground } from "../components/ui";
import AuthField from "../components/auth-field";
import BackButton from "../components/back-button";
import Skyline from "../components/skyline";
import { theme } from "../constants/app-theme";
import { useAuth } from "../context/auth-context";
import { checkLogin } from "../utils/auth";
import { notify } from "../utils/dialog";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    const problem = checkLogin(email, password);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const message = await logIn(email, password);
    // On success the app moves to Home by itself (this screen goes away).
    if (message) {
      setBusy(false);
      setError(message);
    }
  };

  return (
    <PeachBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pad}>
            <BackButton />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Log in to access your travel features</Text>
          </View>

          <Skyline height={96} opacity={0.3} />

          <View style={[styles.pad, styles.form]}>
            <AuthField icon="mail-outline" label="Email address" placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            <AuthField icon="lock-closed-outline" label="Password" placeholder="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoComplete="current-password" textContentType="password" returnKeyType="done" onSubmitEditing={submit} />

            {error && (
              <View style={styles.error} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={18} color={theme.colors.coral} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [styles.primary, (busy || pressed) && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel="Log In"
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Log In</Text>}
            </Pressable>

            <Pressable
              onPress={() =>
                notify(
                  "Password reset isn't available yet",
                  "Resetting a password needs an email service, which isn't set up in this version."
                )
              }
              style={styles.forgot}
              accessibilityRole="button"
              accessibilityLabel="Forgot Password?"
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </Pressable>

            <View style={styles.secure}>
              <Ionicons name="shield-checkmark" size={18} color={theme.colors.success} />
              <Text style={styles.secureText}>Secure &amp; Encrypted</Text>
            </View>

            <Pressable onPress={() => router.replace("/signup")} style={styles.switch} accessibilityRole="button" accessibilityLabel="New here? Create an account">
              <Text style={styles.switchText}>
                New here? <Text style={styles.switchLink}>Create an account</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </PeachBackground>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 24 },
  title: { marginTop: 4, fontSize: 34, fontWeight: "700", fontFamily: theme.fonts.serif, color: theme.colors.heading, textAlign: "center" },
  subtitle: { marginTop: 6, marginBottom: 6, fontSize: 15, color: theme.colors.ink, textAlign: "center" },
  form: { marginTop: 12 },
  error: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.coralSoft, borderRadius: theme.radius.small, padding: 12, marginBottom: 14 },
  errorText: { flex: 1, color: theme.colors.coral, fontWeight: "600" },
  primary: { height: 54, borderRadius: 27, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  forgot: { alignItems: "center", paddingVertical: 16 },
  forgotText: { color: theme.colors.primary, fontWeight: "700", fontSize: 14 },
  secure: { flexDirection: "row", alignSelf: "center", alignItems: "center", gap: 8, backgroundColor: theme.colors.mint, paddingHorizontal: 18, paddingVertical: 10, borderRadius: theme.radius.pill },
  secureText: { color: theme.colors.ink, fontWeight: "600", fontSize: 13 },
  switch: { alignItems: "center", paddingVertical: 18 },
  switchText: { color: theme.colors.ink, fontSize: 14 },
  switchLink: { color: theme.colors.primary, fontWeight: "800" },
});
