import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/auth-context";
import { theme } from "../../constants/app-theme";

export default function AuthScreen() {
  const {
    session,
    isAuthenticated,
    signInWithGoogle,
    redirectToGoogleAuth,
    loginWithCredentials,
    signUpWithCredentials,
    completeOnboarding,
    signOut,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [step, setStep] = useState<"auth" | "onboarding">(
    isAuthenticated ? "onboarding" : "auth"
  );
  const [loading, setLoading] = useState(false);

  // Login & Sign-up fields
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");

  // Onboarding fields
  const [fullName, setFullName] = useState(session?.name || "Abida Rahman");
  const [nationality, setNationality] = useState("Indian");
  const [passportNumber, setPassportNumber] = useState("Z9482103K");
  const [dateOfBirth, setDateOfBirth] = useState("1998-05-14");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [allergies, setAllergies] = useState("Penicillin (Moderate)");
  const [emergencyPhone, setEmergencyPhone] = useState("+91 98765 43210");

  React.useEffect(() => {
    if (session?.name) {
      setFullName(session.name);
    }
  }, [session]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      setStep("auth");
      setEmail("");
      setName("");
      setPin("");
    }
  }, [isAuthenticated]);

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const res = await signInWithGoogle(activeTab);
      if (res && res.success) {
        // Authenticated with Google; user enters the app
      }
    } catch (e) {
      console.warn("Google auth error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim()) {
      Alert.alert("Missing Email", "Please enter your registered email address.");
      return;
    }
    setLoading(true);
    try {
      await loginWithCredentials(email, pin);
    } catch {
      Alert.alert("Login Failed", "Could not complete login.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email.trim() || !name.trim()) {
      Alert.alert("Missing Details", "Please enter your name and email address.");
      return;
    }
    setLoading(true);
    try {
      await signUpWithCredentials(email, name);
      setFullName(name);
      setStep("onboarding");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteBlockchainOnboarding = async () => {
    if (!fullName.trim() || !passportNumber.trim()) {
      Alert.alert("Missing Info", "Please enter your full legal name and passport ID.");
      return;
    }

    setLoading(true);
    try {
      await completeOnboarding({
        fullName,
        nationality,
        passportNumber,
        dateOfBirth,
        bloodGroup,
        allergies,
        emergencyPhone,
      });
    } catch {
      Alert.alert("Error", "Could not complete blockchain anchoring.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#3D1E16", "#782A1B", "#A84323"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={14} color="#FFD38A" />
          <Text style={styles.badgeText}>BLOCKCHAIN TOURIST SAFETY NETWORK</Text>
        </View>

        <Text style={styles.heroTitle}>Smart Tourist Safety & Identity</Text>
        <Text style={styles.heroSubtitle}>
          Decentralized ID • Zero-Knowledge Privacy • Emergency Responders
        </Text>
      </LinearGradient>

      <ScrollView
        style={styles.formContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {step === "auth" ? (
          <View style={styles.card}>
            {/* Login / Register Tab Switcher */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, activeTab === "login" && styles.tabActive]}
                onPress={() => setActiveTab("login")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "login" && styles.tabTextActive,
                  ]}
                >
                  Log In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeTab === "register" && styles.tabActive]}
                onPress={() => setActiveTab("register")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "register" && styles.tabTextActive,
                  ]}
                >
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cardTitle}>
              {activeTab === "login"
                ? "Log In to Your Tourist ID"
                : "Create a Tourist Account"}
            </Text>
            <Text style={styles.cardSub}>
              {activeTab === "login"
                ? "Enter your credentials or use Google to verify your on-chain identity."
                : "Sign up to mint your W3C Decentralized Tourist ID on the blockchain."}
            </Text>

            {/* Google Sign In / Sign Up Button */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleAuth}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={activeTab === "login" ? "Log in with Google" : "Sign up with Google"}
            >
              {loading ? (
                <View style={styles.googleLoadingRow}>
                  <ActivityIndicator size="small" color="#1F2937" />
                  <Text style={styles.googleLoadingText}>
                    Opening Google Account Chooser...
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.googleIconBox}>
                    <Ionicons name="logo-google" size={18} color="#EA4335" />
                  </View>
                  <Text style={styles.googleBtnText}>
                    {activeTab === "login"
                      ? "Log in with Google"
                      : "Sign up with Google"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Direct fallback link if browser blocks popups */}
            <TouchableOpacity
              style={styles.directLinkRow}
              onPress={redirectToGoogleAuth}
              activeOpacity={0.7}
            >
              <Ionicons name="open-outline" size={13} color="#8D6E63" />
              <Text style={styles.directLinkText}>
                Popup blocked? Click here to redirect in full tab
              </Text>
            </TouchableOpacity>

            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>
                {activeTab === "login" ? "OR LOG IN WITH EMAIL" : "OR REGISTER WITH EMAIL"}
              </Text>
              <View style={styles.orLine} />
            </View>

            {activeTab === "register" && (
              <>
                <Text style={styles.inputLabel}>Full Legal Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Abida Rahman"
                  placeholderTextColor={theme.colors.muted}
                  value={name}
                  onChangeText={setName}
                />
              </>
            )}

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. tourist@travelsafety.io"
              placeholderTextColor={theme.colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            {activeTab === "login" && (
              <>
                <Text style={styles.inputLabel}>Security PIN / Password (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 1234"
                  placeholderTextColor={theme.colors.muted}
                  secureTextEntry
                  value={pin}
                  onChangeText={setPin}
                />
              </>
            )}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={activeTab === "login" ? handleEmailLogin : handleEmailSignUp}
              disabled={loading}
            >
              <Ionicons
                name={activeTab === "login" ? "log-in" : "arrow-forward"}
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.primaryBtnText}>
                {activeTab === "login" ? "Log In & Open App" : "Continue to Identity Setup"}
              </Text>
            </TouchableOpacity>

            {/* Quick Switch Helper */}
            <TouchableOpacity
              style={styles.switchAuthPrompt}
              onPress={() => setActiveTab(activeTab === "login" ? "register" : "login")}
            >
              <Text style={styles.switchPromptText}>
                {activeTab === "login"
                  ? "New traveler? Create an account to mint your ID →"
                  : "Already registered? Log in with your Tourist ID →"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.onboardingHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Complete Blockchain Identity</Text>
                <Text style={styles.cardSub}>
                  Enter details to mint your W3C Decentralized Tourist ID (DID).
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  signOut();
                  setStep("auth");
                }}
                style={styles.switchAccountBtn}
              >
                <Text style={styles.switchAccountText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.authInfoBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#0F766E" />
              <Text style={styles.authInfoText}>
                Account: {session?.email} ({session?.authProvider === "google" ? "Google" : "Email"})
              </Text>
            </View>

            <View style={styles.privacyNote}>
              <Ionicons name="lock-closed" size={14} color="#92400E" />
              <Text style={styles.privacyNoteText}>
                Zero-Knowledge Privacy: Passport and medical data stay on this device off-chain. Only a SHA-256 hash is on the blockchain.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Full Legal Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={fullName}
              onChangeText={setFullName}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Nationality</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Indian"
                  value={nationality}
                  onChangeText={setNationality}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Date of Birth</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Passport / Govt ID (Stored Off-Chain Only)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Z9482103K"
              value={passportNumber}
              onChangeText={setPassportNumber}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Blood Group</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. O+"
                  value={bloodGroup}
                  onChangeText={setBloodGroup}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Emergency Phone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+91 98765 43210"
                  value={emergencyPhone}
                  onChangeText={setEmergencyPhone}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Critical Medical Allergies</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Penicillin"
              value={allergies}
              onChangeText={setAllergies}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleCompleteBlockchainOnboarding}
              disabled={loading}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    Mining Block & Anchoring DID...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    Anchor to Blockchain & Enter App
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  hero: {
    paddingTop: 54,
    paddingHorizontal: 22,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  badgeText: {
    color: "#FFECD9",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 6,
  },
  formContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    padding: 20,
    ...theme.shadow,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#F3ECE7",
    padding: 4,
    borderRadius: 14,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
    ...theme.shadow,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.muted,
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  onboardingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  switchAccountBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
  },
  switchAccountText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.muted,
  },
  authInfoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E6F4F1",
    padding: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 10,
  },
  authInfoText: {
    fontSize: 12,
    color: "#0F766E",
    fontWeight: "600",
    flex: 1,
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    padding: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 14,
  },
  privacyNoteText: {
    fontSize: 11,
    color: "#92400E",
    flex: 1,
    lineHeight: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  cardSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 17,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 13,
    borderRadius: 14,
    gap: 10,
    ...theme.shadow,
  },
  googleIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  googleBtnText: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "700",
  },
  googleLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  googleLoadingText: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "600",
  },
  directLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    gap: 5,
  },
  directLinkText: {
    fontSize: 11,
    color: "#8D6E63",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#F3E8E2",
  },
  orText: {
    fontSize: 9,
    fontWeight: "800",
    color: theme.colors.muted,
    letterSpacing: 0.5,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.ink,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#FAF2EC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.ink,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 18,
    gap: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  switchAuthPrompt: {
    marginTop: 16,
    alignItems: "center",
  },
  switchPromptText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "700",
  },
});
