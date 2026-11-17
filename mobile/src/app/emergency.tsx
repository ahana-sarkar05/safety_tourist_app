import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, SectionLabel } from "../components/ui";
import BackButton from "../components/back-button";
import StatusBadge from "../components/status-badge";
import { theme } from "../constants/app-theme";
import { confirm, notify } from "../utils/dialog";
import { useAuth } from "../context/auth-context";
import {
  createGrant,
  formatDateTime,
  getEmergency,
  getRecords,
  listGrants,
  revokeGrant,
  saveEmergency,
  type CreatedGrant,
  type EmergencyInfo,
  type Grant,
  type RecordItem,
} from "../utils/trust";

const DURATIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
] as const;

export default function EmergencyScreen() {
  const { identity } = useAuth();

  // Emergency information
  const [form, setForm] = useState<EmergencyInfo | null>(null); // null until loaded
  const [hasSaved, setHasSaved] = useState(false);
  const [anchorStatus, setAnchorStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Access codes
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [history, setHistory] = useState<RecordItem[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [label, setLabel] = useState("");
  const [hours, setHours] = useState<number>(24);
  const [creating, setCreating] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<CreatedGrant | null>(null);

  // Load the saved emergency information once.
  useEffect(() => {
    if (!identity) return;
    let alive = true;
    getEmergency(identity).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setForm(r.data.info ?? { contactName: "", contactPhone: "", notes: "" });
        setHasSaved(Boolean(r.data.info));
        setAnchorStatus(r.data.anchor?.status ?? null);
      } else {
        setForm({ contactName: "", contactPhone: "", notes: "" });
        setSaveMsg({ ok: false, text: r.error });
      }
    });
    return () => {
      alive = false;
    };
  }, [identity]);

  // Keep the access-code list fresh (so "opened N times" updates).
  useEffect(() => {
    if (!identity) return;
    let alive = true;
    const load = async () => {
      const [r, rec] = await Promise.all([listGrants(identity), getRecords(identity)]);
      if (alive && r.ok) setGrants(r.data.grants);
      if (alive && rec.ok) setHistory(rec.data.records.filter((x) => x.type === "emergency_access"));
    };
    void load();
    const timer = setInterval(load, 6000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [identity, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const save = async () => {
    if (!identity || !form || saving) return;
    setSaving(true);
    setSaveMsg(null);
    const r = await saveEmergency(identity, form);
    setSaving(false);
    if (!r.ok) {
      setSaveMsg({ ok: false, text: r.error });
      return;
    }
    setHasSaved(true);
    setAnchorStatus("pending");
    setSaveMsg({ ok: true, text: "Saved. Only an encrypted copy is stored." });
  };

  const create = async () => {
    if (!identity || creating) return;
    setCreating(true);
    setGrantError(null);
    const r = await createGrant(identity, label.trim() || "Trusted contact", hours);
    setCreating(false);
    if (!r.ok) {
      setGrantError(r.error);
      return;
    }
    setFresh(r.data);
    setLabel("");
    reload();
  };

  const shareCode = async (g: CreatedGrant) => {
    const message = `My emergency access code: ${g.code}\nTourist ID: ${identity?.touristId}\nValid until ${formatDateTime(g.expiresAt)}.`;
    try {
      await Share.share({ message });
    } catch {
      notify("Your access code", `${g.code}\n\nWrite it down and give it to the person you trust.`);
    }
  };

  const revoke = async (g: Grant) => {
    if (!identity) return;
    const ok = await confirm({
      title: `Revoke access for ${g.label}?`,
      message: "Their code will stop working immediately.",
      confirmText: "Revoke",
      cancelText: "Keep",
      destructive: true,
    });
    if (!ok) return;
    const r = await revokeGrant(identity, g.grantId);
    if (!r.ok) notify("Couldn't revoke", r.error);
    reload();
  };

  if (!identity) return null; // signed out: the app is already redirecting

  return (
    <Screen title="Emergency Sharing" subtitle="Share only with people you trust">
      <BackButton />

      <Card style={styles.intro}>
        <View style={styles.introIcon}>
          <Ionicons name="shield-half" size={30} color={theme.colors.coral} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.introTitle}>Emergency Information (Encrypted)</Text>
          <Text style={styles.introText}>Share your emergency contact with trusted people, only when needed.</Text>
        </View>
      </Card>

      <SectionLabel>Emergency information</SectionLabel>
      <Card>
        {form === null ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <>
            <Text style={styles.label}>Emergency contact name</Text>
            <TextInput style={styles.input} value={form.contactName} onChangeText={(v) => setForm({ ...form, contactName: v })} placeholder="Who should be called?" placeholderTextColor={theme.colors.muted} autoCapitalize="words" maxLength={80} />
            <Text style={styles.label}>Emergency contact phone</Text>
            <TextInput style={styles.input} value={form.contactPhone} onChangeText={(v) => setForm({ ...form, contactPhone: v })} placeholder="+91 98765 43210" placeholderTextColor={theme.colors.muted} keyboardType="phone-pad" maxLength={24} />
            <Text style={styles.label}>Medical or other notes (optional)</Text>
            <TextInput style={[styles.input, styles.notes]} value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} placeholder="Allergies, conditions, medication…" placeholderTextColor={theme.colors.muted} multiline textAlignVertical="top" maxLength={300} />

            {saveMsg && (
              <View style={[styles.msg, { backgroundColor: saveMsg.ok ? theme.colors.mint : theme.colors.coralSoft }]} accessibilityRole="alert">
                <Ionicons name={saveMsg.ok ? "checkmark-circle" : "alert-circle"} size={18} color={saveMsg.ok ? theme.colors.success : theme.colors.coral} />
                <Text style={[styles.msgText, { color: saveMsg.ok ? theme.colors.success : theme.colors.coral }]}>{saveMsg.text}</Text>
              </View>
            )}

            <Pressable onPress={save} disabled={saving} style={[styles.primary, saving && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Save emergency information">
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Save emergency information</Text>}
            </Pressable>
            {hasSaved && (
              <Text style={styles.meta}>
                {anchorStatus === "anchored" ? "Fingerprint anchored on the blockchain." : "Fingerprint waiting to be anchored on the blockchain."}
              </Text>
            )}
          </>
        )}
      </Card>

      <SectionLabel>Give someone access</SectionLabel>
      {fresh ? (
        <Card style={styles.codeCard}>
          <Text style={styles.codeTitle}>Access code for {fresh.label}</Text>
          <Text style={styles.code} accessibilityLabel={`Access code ${fresh.code}`} selectable>
            {fresh.code}
          </Text>
          <Text style={styles.meta}>Valid until {formatDateTime(fresh.expiresAt)}</Text>
          <Text style={[styles.meta, { color: theme.colors.coral, fontWeight: "700" }]}>
            This code is shown only once. Share it now.
          </Text>
          <View style={styles.codeButtons}>
            <Pressable onPress={() => void shareCode(fresh)} style={[styles.primary, { flex: 1 }]} accessibilityRole="button" accessibilityLabel="Share code">
              <Text style={styles.primaryText}>Share code</Text>
            </Pressable>
            <Pressable onPress={() => setFresh(null)} style={styles.done} accessibilityRole="button" accessibilityLabel="Done">
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <Card>
          {form !== null && !hasSaved && (
            <Text style={[styles.meta, { marginBottom: 10 }]}>Save your emergency information above first.</Text>
          )}
          <Text style={styles.label}>Who is this for?</Text>
          <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="e.g. Dr. Mehta, Hotel manager" placeholderTextColor={theme.colors.muted} maxLength={40} />
          <Text style={styles.label}>Access lasts</Text>
          <View style={styles.chips}>
            {DURATIONS.map((d) => (
              <Pressable key={d.hours} onPress={() => setHours(d.hours)} style={[styles.chip, hours === d.hours && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: hours === d.hours }} accessibilityLabel={`Access lasts ${d.label}`}>
                <Text style={[styles.chipText, hours === d.hours && styles.chipTextOn]}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
          {grantError && (
            <View style={[styles.msg, { backgroundColor: theme.colors.coralSoft }]} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={18} color={theme.colors.coral} />
              <Text style={[styles.msgText, { color: theme.colors.coral }]}>{grantError}</Text>
            </View>
          )}
          <Pressable onPress={create} disabled={creating || !hasSaved} style={[styles.primary, (creating || !hasSaved) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Create access code">
            {creating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Create access code</Text>}
          </Pressable>
          <Text style={styles.meta}>
            Each code you create or revoke is recorded on the blockchain as proof. The code itself is never stored.
          </Text>
        </Card>
      )}

      <SectionLabel>Access codes</SectionLabel>
      {grants === null ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : grants.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptySub}>No access codes yet. Nobody can see your emergency information.</Text>
        </Card>
      ) : (
        grants.map((g) => {
          const expired = !g.revokedAt && !g.active;
          return (
            <Card key={g.grantId}>
              <View style={styles.grantHead}>
                <Text style={styles.grantLabel}>{g.label}</Text>
                {g.active ? <StatusBadge status="verified" label="Active" /> : g.revokedAt ? <StatusBadge status="revoked" /> : <StatusBadge status="unverified" label="Expired" />}
              </View>
              <Text style={styles.meta}>
                {expired || g.revokedAt ? "Ended" : "Expires"} {formatDateTime(g.revokedAt ?? g.expiresAt)}
              </Text>
              <Text style={styles.meta}>
                {g.uses === 0 ? "Not used yet" : `Opened ${g.uses} time${g.uses === 1 ? "" : "s"} · last ${formatDateTime(g.lastUsedAt)}`}
              </Text>
              {g.active && (
                <Pressable onPress={() => void revoke(g)} style={styles.revoke} accessibilityRole="button" accessibilityLabel={`Revoke access for ${g.label}`}>
                  <Text style={styles.revokeText}>Revoke access</Text>
                </Pressable>
              )}
            </Card>
          );
        })
      )}
      <SectionLabel>Access history</SectionLabel>
      {history === null ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : history.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptySub}>Nobody has opened your emergency information.</Text>
        </Card>
      ) : (
        <Card>
          {history.map((h, i) => (
            <View key={h.recordId} style={[styles.histRow, i > 0 && styles.histBorder]}>
              <Ionicons name="eye" size={20} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.histTitle}>{h.summary.replace("Emergency information opened: ", "Opened by ")}</Text>
                <Text style={styles.meta}>{formatDateTime(h.createdAt)}</Text>
              </View>
              <StatusBadge status={h.status} />
            </View>
          ))}
          <Text style={[styles.meta, { marginTop: 10 }]}>
            Each time your information is opened, it is recorded on the blockchain. This history can&apos;t be erased.
          </Text>
        </Card>
      )}

      <View style={{ height: 24 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: theme.colors.cardTint },
  introIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: theme.colors.card, alignItems: "center", justifyContent: "center" },
  introTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.ink },
  introText: { color: theme.colors.muted, marginTop: 2, lineHeight: 19 },
  histRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  histBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  histTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
  empty: { alignItems: "center", gap: 6, paddingVertical: 22 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.ink, marginTop: 8 },
  emptySub: { color: theme.colors.muted, textAlign: "center" },
  label: { fontSize: 13, fontWeight: "700", color: theme.colors.muted, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.ink,
    marginBottom: 12,
  },
  notes: { minHeight: 84 },
  msg: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: theme.radius.small, padding: 12, marginBottom: 12 },
  msgText: { flex: 1, fontWeight: "600" },
  primary: { height: 52, paddingHorizontal: 22, borderRadius: 26, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 6, lineHeight: 18 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 14, height: 38, justifyContent: "center", borderRadius: theme.radius.pill, backgroundColor: theme.colors.primarySoft },
  chipOn: { backgroundColor: theme.colors.primary },
  chipText: { color: theme.colors.ink, fontWeight: "600" },
  chipTextOn: { color: "#FFFFFF" },

  codeCard: { alignItems: "center" },
  codeTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.muted },
  code: { fontSize: 38, fontWeight: "800", letterSpacing: 4, color: theme.colors.ink, marginVertical: 12 },
  codeButtons: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 14, alignSelf: "stretch" },
  done: { height: 52, paddingHorizontal: 18, justifyContent: "center" },
  doneText: { color: theme.colors.muted, fontWeight: "700" },

  grantHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 },
  grantLabel: { flex: 1, fontSize: 16, fontWeight: "800", color: theme.colors.ink },
  revoke: { alignSelf: "flex-start", marginTop: 12, paddingHorizontal: 16, height: 38, borderRadius: 19, backgroundColor: theme.colors.coralSoft, justifyContent: "center" },
  revokeText: { color: theme.colors.coral, fontWeight: "800" },
});
