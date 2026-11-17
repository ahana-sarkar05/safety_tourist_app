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
import { checkSignup } from "../utils/auth";

export default function SignUp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [nationality, setNationality] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    const input = { fullName, nationality, email, password, confirm };
    const problem = checkSignup(input);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const message = await signUp(input);
      setBusy(false);
      if (message) {
        setError(message);
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      setBusy(false);
      setError("An unexpected error occurred. Please try again.");
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join our travel community</Text>
          </View>

          <Skyline height={96} opacity={0.3} />

          <View style={[styles.pad, styles.form]}>
            <AuthField icon="person-outline" label="Full name" placeholder="Full Name" value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" textContentType="name" maxLength={80} />
            <AuthField icon="flag-outline" label="Nationality" placeholder="Nationality" value={nationality} onChangeText={setNationality} autoCapitalize="words" maxLength={60} />
            <AuthField icon="mail-outline" label="Email address" placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            <AuthField icon="lock-closed-outline" label="Password" placeholder="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
            <AuthField icon="lock-closed-outline" label="Confirm password" placeholder="Confirm Password" value={confirm} onChangeText={setConfirm} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" returnKeyType="done" onSubmitEditing={submit} />

            <Text style={styles.hint}>At least 8 characters, with a letter and a number. Signing up creates your Digital Tourist ID.</Text>

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
              accessibilityLabel="Sign Up"
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Sign Up</Text>}
            </Pressable>

            <Pressable onPress={() => router.replace("/login")} style={styles.switch} accessibilityRole="button" accessibilityLabel="Already have an account? Log In">
              <Text style={styles.switchText}>
                Already have an account? <Text style={styles.switchLink}>Log In</Text>
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
  hint: { color: theme.colors.muted, fontSize: 13, lineHeight: 18, marginBottom: 14, textAlign: "center" },
  error: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.coralSoft, borderRadius: theme.radius.small, padding: 12, marginBottom: 14 },
  errorText: { flex: 1, color: theme.colors.coral, fontWeight: "600" },
  primary: { height: 54, borderRadius: 27, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  switch: { alignItems: "center", paddingVertical: 18 },
  switchText: { color: theme.colors.ink, fontSize: 14 },
  switchLink: { color: theme.colors.primary, fontWeight: "800" },
});
