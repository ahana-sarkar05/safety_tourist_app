import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Screen, Card, IconBadge, SectionLabel } from "../components/ui";
import BackButton from "../components/back-button";
import StatusBadge from "../components/status-badge";
import { theme } from "../constants/app-theme";
import {
  TRAVEL_KINDS,
  accessEmergency,
  demoRestore,
  demoTamper,
  formatDateTime,
  resolveTouristId,
  shortHash,
  verifyTourist,
  type AccessResult,
  type TravelKind,
  type VerifyResult,
} from "../utils/trust";

export default function VerifyScreen() {
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const [permission, requestPermission] = useCameraPermissions();

  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");

  const [code, setCode] = useState("");
  const [access, setAccess] = useState<AccessResult | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessBusy, setAccessBusy] = useState(false);

  const scanned = useRef(false); // the camera fires many times per second

  // Opened from "Verify my ID": check that ID straight away.
  useEffect(() => {
    if (!idParam) return;
    let alive = true;
    verifyTourist(String(idParam)).then((r) => {
      if (!alive) return;
      if (r.ok) setResult(r.data);
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [idParam]);

  const check = async (touristId: string) => {
    setBusy(true);
    setError(null);
    const r = await verifyTourist(touristId);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      scanned.current = false;
      return;
    }
    setAccess(null);
    setAccessError(null);
    setCode("");
    setResult(r.data);
  };

  const onScan = ({ data }: { data: string }) => {
    if (scanned.current) return;
    const id = resolveTouristId(data);
    if (!id) {
      setError("That QR code isn't a Tourist ID.");
      return;
    }
    scanned.current = true;
    void check(id);
  };

  const submitManual = () => {
    const id = resolveTouristId(manual);
    if (!id) {
      setError("Enter an ID like TOURIST-2026-001.");
      return;
    }
    void check(id);
  };

  const reset = () => {
    scanned.current = false;
    setResult(null);
    setError(null);
    setAccess(null);
    setAccessError(null);
    setCode("");
    setManual("");
  };

  const openEmergency = async () => {
    if (!result) return;
    setAccessBusy(true);
    setAccessError(null);
    const r = await accessEmergency(result.touristId, code);
    setAccessBusy(false);
    if (r.ok) setAccess(r.data);
    else setAccessError(r.error);
  };

  const demo = async (action: "tamper" | "restore") => {
    if (!result) return;
    if (action === "tamper") await demoTamper(result.touristId);
    else await demoRestore(result.touristId);
    await check(result.touristId);
  };

  // ---------- waiting on an ID passed in from another screen ----------
  if (!result && idParam && !error) {
    return (
      <Screen title="Verify" subtitle="Checking this ID">
        <BackButton />
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
      </Screen>
    );
  }

  // ---------- result ----------
  if (result) {
    const good = result.status === "verified";
    return (
      <Screen title="Verification" subtitle={result.touristId}>
        <BackButton />

        <Card style={{ ...styles.banner, backgroundColor: good ? theme.colors.mint : theme.colors.card }}>
          <StatusBadge status={result.status} large />
          <Text style={styles.bannerText}>{result.message}</Text>
        </Card>

        {result.status !== "not_found" && (
          <Card>
            <View style={styles.personRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(result.displayName ?? "?")[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{result.displayName}</Text>
                <Text style={styles.meta}>{result.nationality}</Text>
                <Text style={styles.meta}>Registered {formatDateTime(result.registeredAt ?? null)}</Text>
              </View>
            </View>
          </Card>
        )}

        {result.checks.length > 0 && (
          <>
            <SectionLabel>What we checked</SectionLabel>
            <Card>
              {result.checks.map((c, i) => (
                <View key={c.id} style={[styles.checkRow, i > 0 && styles.checkBorder]}>
                  <Ionicons
                    name={c.ok === true ? "checkmark-circle" : c.ok === false ? "close-circle" : "remove-circle-outline"}
                    size={22}
                    color={c.ok === true ? theme.colors.success : c.ok === false ? theme.colors.coral : theme.colors.muted}
                  />
                  <Text style={styles.checkLabel}>{c.label}</Text>
                  <Text style={styles.checkState}>{c.ok === true ? "Yes" : c.ok === false ? "No" : "Not checked"}</Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {result.chain && (
          <Card style={styles.chainCard}>
            <Ionicons name="link" size={20} color={theme.colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.chainTitle}>Blockchain fingerprint{result.chain.network ? ` (${result.chain.network})` : ""}</Text>
              <Text style={styles.mono}>{shortHash(result.chain.fingerprint)}</Text>
              {result.chain.anchoredAt ? (
                <Text style={styles.meta}>Anchored {formatDateTime(result.chain.anchoredAt)}</Text>
              ) : null}
              {result.chain.txHash ? <Text style={styles.meta}>Transaction {shortHash(result.chain.txHash)}</Text> : null}
              {!result.chain.available && result.chain.reason ? (
                <Text style={[styles.meta, { color: theme.colors.coral }]}>{result.chain.reason}</Text>
              ) : null}
            </View>
          </Card>
        )}

        {result.records.length > 0 && (
          <>
            <SectionLabel>Travel records</SectionLabel>
            <Card>
              {result.records.map((r, i) => (
                <View key={`${r.createdAt}-${i}`} style={[styles.checkRow, i > 0 && styles.checkBorder]}>
                  <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkLabel}>{TRAVEL_KINDS[r.kind as TravelKind]?.label ?? "Record"}</Text>
                    <Text style={styles.meta}>{formatDateTime(r.createdAt)}</Text>
                  </View>
                  <StatusBadge status={r.status} />
                </View>
              ))}
            </Card>
          </>
        )}

        {result.status !== "not_found" && result.status !== "revoked" && (
          <>
            <SectionLabel>Emergency access</SectionLabel>
            <Card>
              {access ? (
                <View>
                  <Text style={styles.accessTitle}>
                    {access.fullName} · {access.nationality}
                  </Text>
                  {access.emergency ? (
                    <>
                      <Text style={styles.label}>Emergency contact</Text>
                      <Text style={styles.accessValue}>{access.emergency.contactName}</Text>
                      <Pressable
                        onPress={() => void Linking.openURL(`tel:${access.emergency?.contactPhone}`)}
                        style={styles.callBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Call ${access.emergency.contactName}`}
                      >
                        <Ionicons name="call" size={18} color="#FFFFFF" />
                        <Text style={styles.callText}>{access.emergency.contactPhone}</Text>
                      </Pressable>
                      {access.emergency.notes ? (
                        <>
                          <Text style={styles.label}>Medical / other notes</Text>
                          <Text style={styles.accessValue}>{access.emergency.notes}</Text>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.meta}>No emergency information has been added.</Text>
                  )}
                  <Text style={[styles.meta, { marginTop: 10 }]}>
                    Access: {access.grantLabel} · expires {formatDateTime(access.expiresAt)}
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.meta}>
                    If this tourist gave you an access code, enter it to see their emergency information.
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={code}
                    onChangeText={setCode}
                    placeholder="ABCD-EFGH"
                    placeholderTextColor={theme.colors.muted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={9}
                  />
                  {accessError && <Text style={styles.errorText}>{accessError}</Text>}
                  <Pressable
                    onPress={openEmergency}
                    disabled={accessBusy || code.trim().length < 8}
                    style={({ pressed }) => [
                      styles.softBtn,
                      (accessBusy || code.trim().length < 8) && { opacity: 0.45 },
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Open emergency information"
                  >
                    {accessBusy ? (
                      <ActivityIndicator color={theme.colors.primary} />
                    ) : (
                      <Text style={styles.softBtnText}>Open emergency information</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </Card>
          </>
        )}

        {result.demoMode && result.status !== "not_found" && (
          <>
            <SectionLabel>Demo tools</SectionLabel>
            <Card>
              <Text style={styles.meta}>
                Simulates someone secretly editing this tourist&apos;s record in the database. Watch
                verification fail, then restore it.
              </Text>
              <View style={styles.demoRow}>
                <Pressable
                  onPress={() => void demo("tamper")}
                  style={[styles.demoBtn, { backgroundColor: theme.colors.coralSoft }]}
                  accessibilityRole="button"
                  accessibilityLabel="Tamper with this record (demo)"
                >
                  <Ionicons name="bug" size={16} color={theme.colors.coral} />
                  <Text style={[styles.demoText, { color: theme.colors.coral }]}>Tamper</Text>
                </Pressable>
                <Pressable
                  onPress={() => void demo("restore")}
                  style={[styles.demoBtn, { backgroundColor: theme.colors.primarySoft }]}
                  accessibilityRole="button"
                  accessibilityLabel="Restore the record (demo)"
                >
                  <Ionicons name="refresh" size={16} color={theme.colors.primary} />
                  <Text style={[styles.demoText, { color: theme.colors.primary }]}>Restore</Text>
                </Pressable>
              </View>
            </Card>
          </>
        )}

        <Pressable
          onPress={() => void check(result.touristId)}
          style={styles.linkBtn}
          accessibilityRole="button"
          accessibilityLabel="Check again"
        >
          <Text style={styles.linkText}>Check again</Text>
        </Pressable>
        <Pressable onPress={reset} style={styles.primary} accessibilityRole="button" accessibilityLabel="Verify another ID">
          <Text style={styles.primaryText}>Verify another ID</Text>
        </Pressable>
        <View style={{ height: 24 }} />
      </Screen>
    );
  }

  // ---------- scan / enter ----------
  const camera = permission?.granted;
  return (
    <Screen title="Verify identity" subtitle="Scan a Tourist ID QR code">
      <BackButton />

      {camera ? (
        <View style={styles.cameraBox}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={busy ? undefined : onScan}
          />
          <View style={styles.frame} pointerEvents="none" />
          {busy && (
            <View style={styles.cameraBusy}>
              <ActivityIndicator color="#FFFFFF" size="large" />
            </View>
          )}
        </View>
      ) : (
        <Card style={styles.permCard}>
          <IconBadge name="camera" />
          <Text style={styles.permTitle}>Camera access needed to scan</Text>
          <Text style={styles.meta}>You can also type the ID below instead.</Text>
          {permission?.canAskAgain === false ? (
            <Pressable onPress={() => void Linking.openSettings()} style={styles.softBtn} accessibilityRole="button">
              <Text style={styles.softBtnText}>Open Settings</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void requestPermission()}
              style={styles.softBtn}
              accessibilityRole="button"
              accessibilityLabel="Allow camera"
            >
              <Text style={styles.softBtnText}>Allow camera</Text>
            </Pressable>
          )}
        </Card>
      )}

      {error && (
        <View style={styles.error} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={18} color={theme.colors.coral} />
          <Text style={styles.errorBoxText}>{error}</Text>
        </View>
      )}

      <Text style={styles.or}>or enter the ID</Text>
      <Card>
        <TextInput
          style={styles.input}
          value={manual}
          onChangeText={setManual}
          placeholder="TOURIST-2026-001"
          placeholderTextColor={theme.colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Pressable
          onPress={submitManual}
          disabled={busy}
          style={({ pressed }) => [styles.primary, (busy || pressed) && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="Verify ID"
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Verify</Text>}
        </Pressable>
      </Card>
      <View style={{ height: 24 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { alignItems: "flex-start", gap: 10 },
  bannerText: { color: theme.colors.ink, fontSize: 15, lineHeight: 21 },

  personRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  personName: { fontSize: 18, fontWeight: "800", color: theme.colors.ink },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },

  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  checkBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  checkLabel: { flex: 1, color: theme.colors.ink, fontSize: 14, fontWeight: "600" },
  checkState: { color: theme.colors.muted, fontSize: 12, fontWeight: "700" },

  chainCard: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  chainTitle: { fontWeight: "800", color: theme.colors.ink },
  mono: { fontFamily: "monospace", color: theme.colors.ink, marginTop: 3, fontSize: 13 },

  accessTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.ink, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, marginTop: 10 },
  accessValue: { fontSize: 16, color: theme.colors.ink, marginTop: 2 },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.success,
  },
  callText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },

  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.ink,
    marginVertical: 10,
  },
  errorText: { color: theme.colors.coral, fontWeight: "600", marginBottom: 8 },
  softBtn: {
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  softBtnText: { color: theme.colors.primary, fontWeight: "700", fontSize: 15 },

  demoRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  demoBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  demoText: { fontWeight: "800" },

  linkBtn: { alignItems: "center", paddingVertical: 12 },
  linkText: { color: theme.colors.primary, fontWeight: "700" },
  primary: {
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  cameraBox: {
    height: 320,
    borderRadius: theme.radius.card,
    overflow: "hidden",
    backgroundColor: "#000000",
    marginBottom: 12,
  },
  frame: {
    position: "absolute",
    top: "20%",
    left: "20%",
    right: "20%",
    bottom: "20%",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 18,
    opacity: 0.85,
  },
  cameraBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  permCard: { alignItems: "center", gap: 8, paddingVertical: 24 },
  permTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.ink, marginTop: 6 },
  or: { textAlign: "center", color: theme.colors.muted, fontWeight: "600", marginVertical: 12 },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.coralSoft,
    borderRadius: theme.radius.small,
    padding: 12,
    marginBottom: 4,
  },
  errorBoxText: { flex: 1, color: theme.colors.coral, fontWeight: "600" },
});
