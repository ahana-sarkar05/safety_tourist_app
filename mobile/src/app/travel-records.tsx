import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, SectionLabel } from "../components/ui";
import BackButton from "../components/back-button";
import StatusBadge from "../components/status-badge";
import { theme } from "../constants/app-theme";
import { useAuth } from "../context/auth-context";
import {
  TRAVEL_KINDS,
  addTravelRecord,
  demoRestore,
  demoTamper,
  formatDateTime,
  getChainInfo,
  getRecords,
  shortHash,
  type ChainInfo,
  type RecordItem,
  type TravelKind,
} from "../utils/trust";

const OTHER_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  emergency_update: "medkit",
  consent_grant: "key",
  consent_revoke: "lock-closed",
  emergency_access: "eye",
};

const TITLE_HINTS: Record<TravelKind, string> = {
  flight: "e.g. Flight to Delhi",
  hotel: "e.g. Taj Hotel stay",
  permit: "e.g. Chilika lake permit",
  booking: "e.g. Train to Jaipur",
};

function iconFor(r: RecordItem): keyof typeof Ionicons.glyphMap {
  if (r.type === "travel_permit" && r.details) return TRAVEL_KINDS[r.details.kind]?.icon ?? "document-text";
  return OTHER_ICONS[r.type] ?? "document";
}

export default function TravelRecordsScreen() {
  const { identity } = useAuth();

  const [records, setRecords] = useState<RecordItem[] | null>(null);
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<TravelKind>("flight");
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load now, then refresh every few seconds so "Pending" turns into "Verified"
  // by itself once the blockchain confirms.
  useEffect(() => {
    if (!identity) return;
    let alive = true;
    const load = async () => {
      const [r, c] = await Promise.all([getRecords(identity), getChainInfo()]);
      if (!alive) return;
      if (r.ok) {
        setRecords(r.data.records);
        setError(null);
      } else {
        setError(r.error);
      }
      if (c.ok) setChainInfo(c.data);
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [identity, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const save = async () => {
    if (!identity || saving) return;
    if (title.trim().length < 2) return setFormError("Enter a title.");
    if (reference.trim().length < 2) return setFormError("Enter a reference number.");
    setSaving(true);
    setFormError(null);
    const r = await addTravelRecord(identity, { kind, title, reference, validFrom, validTo });
    setSaving(false);
    if (!r.ok) {
      setFormError(r.error);
      return;
    }
    setTitle("");
    setReference("");
    setValidFrom("");
    setValidTo("");
    setFormOpen(false);
    reload();
  };

  const tamper = async (recordId: string) => {
    if (!identity) return;
    await demoTamper(identity.touristId, recordId);
    reload();
  };
  const restore = async () => {
    if (!identity) return;
    await demoRestore(identity.touristId);
    reload();
  };

  if (!identity) return null; // signed out: the app is already redirecting

  const demo = chainInfo?.demoMode === true;
  const anchored = records?.filter((r) => r.anchor.status === "anchored").length ?? 0;

  return (
    <Screen title="Travel Records" subtitle="Each record's fingerprint is anchored on the blockchain">
      <BackButton />

      {chainInfo && !chainInfo.available && (
        <Card style={styles.notice}>
          <Ionicons name="cloud-offline" size={20} color={theme.colors.coral} />
          <Text style={styles.noticeText}>
            The blockchain isn&apos;t connected right now. Records are saved and will be verified
            automatically once it is.
          </Text>
        </Card>
      )}

      {formOpen ? (
        <Card>
          <Text style={styles.formTitle}>New travel record</Text>

          <View style={styles.kindRow}>
            {(Object.keys(TRAVEL_KINDS) as TravelKind[]).map((k) => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[styles.chip, kind === k && styles.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: kind === k }}
                accessibilityLabel={TRAVEL_KINDS[k].label}
              >
                <Ionicons name={TRAVEL_KINDS[k].icon} size={15} color={kind === k ? "#FFFFFF" : theme.colors.primary} />
                <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>{TRAVEL_KINDS[k].label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={TITLE_HINTS[kind]} placeholderTextColor={theme.colors.muted} maxLength={80} />
          <Text style={styles.label}>Reference number</Text>
          <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="e.g. CL-2026-77" placeholderTextColor={theme.colors.muted} autoCapitalize="characters" maxLength={60} />
          <View style={styles.dates}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>From (optional)</Text>
              <TextInput style={styles.input} value={validFrom} onChangeText={setValidFrom} placeholder="2026-11-05" placeholderTextColor={theme.colors.muted} maxLength={10} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>To (optional)</Text>
              <TextInput style={styles.input} value={validTo} onChangeText={setValidTo} placeholder="2026-11-12" placeholderTextColor={theme.colors.muted} maxLength={10} />
            </View>
          </View>

          {formError && (
            <View style={styles.error} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={18} color={theme.colors.coral} />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          )}

          <View style={styles.formButtons}>
            <Pressable onPress={() => { setFormOpen(false); setFormError(null); }} style={styles.cancel} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={saving} style={[styles.primary, { flex: 1 }, saving && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Save record">
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Save record</Text>}
            </Pressable>
          </View>
        </Card>
      ) : (
        <Pressable onPress={() => setFormOpen(true)} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Add a travel record">
          <Ionicons name="add-circle" size={22} color={theme.colors.primary} />
          <Text style={styles.addText}>Add a travel record</Text>
        </Pressable>
      )}

      <SectionLabel>Your records</SectionLabel>

      {error && (
        <Card style={styles.notice}>
          <Text style={styles.noticeText}>{error}</Text>
        </Card>
      )}

      {records === null && !error ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 12 }} />
      ) : records && records.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptySub}>No records yet. Add a flight, hotel or permit above.</Text>
        </Card>
      ) : (
        records?.map((r) => {
          const d = r.details;
          return (
            <Card key={r.recordId}>
              <View style={styles.recHead}>
                <View style={styles.recIcon}>
                  <Ionicons name={iconFor(r)} size={22} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recTitle}>{d ? d.title : r.summary}</Text>
                  {d ? (
                    <Text style={styles.meta}>
                      {TRAVEL_KINDS[d.kind]?.label ?? "Record"} · Ref {d.reference}
                      {d.validFrom || d.validTo ? ` · ${d.validFrom ?? "…"} to ${d.validTo ?? "…"}` : ""}
                    </Text>
                  ) : null}
                  <Text style={styles.meta}>{formatDateTime(r.createdAt)}</Text>
                </View>
                <StatusBadge status={r.status} />
              </View>
              <Text style={styles.mono}>Fingerprint {shortHash(r.fingerprint)}</Text>
              {r.reason ? <Text style={[styles.meta, { color: theme.colors.coral }]}>{r.reason}</Text> : null}
              {r.anchor.txHash ? <Text style={styles.meta}>On-chain transaction {shortHash(r.anchor.txHash)}</Text> : null}
              {demo && r.type === "travel_permit" && (
                <Pressable onPress={() => void tamper(r.recordId)} style={styles.tamper} accessibilityRole="button" accessibilityLabel={`Tamper with ${r.summary} (demo)`}>
                  <Ionicons name="bug" size={14} color={theme.colors.coral} />
                  <Text style={styles.tamperText}>Demo: tamper with this record</Text>
                </Pressable>
              )}
            </Card>
          );
        })
      )}

      {records && records.length > 0 && (
        <Card style={styles.history}>
          <View style={styles.historyIcon}>
            <Ionicons name="shield-checkmark" size={26} color={theme.colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyTitle}>Blockchain History</Text>
            <Text style={styles.historyText}>
              {anchored} of {records.length} record{records.length === 1 ? "" : "s"} securely stored on the
              blockchain{chainInfo ? ` (${chainInfo.network})` : ""}.
            </Text>
          </View>
        </Card>
      )}

      {demo && (
        <Pressable onPress={() => void restore()} style={styles.restore} accessibilityRole="button" accessibilityLabel="Restore all records (demo)">
          <Ionicons name="refresh" size={16} color={theme.colors.primary} />
          <Text style={styles.restoreText}>Demo: restore tampered data</Text>
        </Pressable>
      )}
      <View style={{ height: 24 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", gap: 6, paddingVertical: 24 },
  emptySub: { color: theme.colors.muted, textAlign: "center" },
  notice: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: theme.colors.coralSoft },
  noticeText: { flex: 1, color: theme.colors.ink, lineHeight: 19 },

  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed", borderColor: theme.colors.primary, marginBottom: 14 },
  addText: { color: theme.colors.primary, fontWeight: "700", fontSize: 15 },

  formTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.ink, marginBottom: 12 },
  kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 38, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primarySoft },
  chipOn: { backgroundColor: theme.colors.primary },
  chipText: { color: theme.colors.ink, fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#FFFFFF" },
  label: { fontSize: 13, fontWeight: "700", color: theme.colors.muted, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.small, backgroundColor: theme.colors.bg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: theme.colors.ink, marginBottom: 12 },
  dates: { flexDirection: "row", gap: 10 },
  error: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.coralSoft, borderRadius: theme.radius.small, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, color: theme.colors.coral, fontWeight: "600" },
  formButtons: { flexDirection: "row", gap: 10, alignItems: "center" },
  cancel: { height: 52, paddingHorizontal: 18, justifyContent: "center" },
  cancelText: { color: theme.colors.muted, fontWeight: "700" },
  primary: { height: 52, paddingHorizontal: 22, borderRadius: 26, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  recHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  recIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  recTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.ink },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 2 },
  mono: { fontFamily: "monospace", color: theme.colors.muted, fontSize: 12, marginTop: 10 },
  tamper: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start" },
  tamperText: { color: theme.colors.coral, fontWeight: "700", fontSize: 13 },

  history: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: theme.colors.cardTint },
  historyIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.card, alignItems: "center", justifyContent: "center" },
  historyTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.ink },
  historyText: { color: theme.colors.muted, marginTop: 2, lineHeight: 19 },

  restore: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  restoreText: { color: theme.colors.primary, fontWeight: "700" },
});
