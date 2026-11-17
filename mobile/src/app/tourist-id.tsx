import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Share } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { Screen, Card, IconBadge } from "../components/ui";
import BackButton from "../components/back-button";
import StatusBadge from "../components/status-badge";
import { theme } from "../constants/app-theme";
import { useAuth } from "../context/auth-context";
import { notify } from "../utils/dialog";
import { qrPayload } from "../utils/identity";
import { formatDateTime, shortHash, verifyTourist, type VerifyResult } from "../utils/trust";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// One short phrase for the Blockchain Status box.
function statusPhrase(v: VerifyResult | null): string {
  switch (v?.status) {
    case "verified":
      return "Record Verified";
    case "failed":
      return "Record has been modified";
    case "revoked":
      return "ID revoked";
    case "unverified":
      return v.chain?.available === false ? "Blockchain not reachable" : "Waiting to be anchored";
    default:
      return "Checking…";
  }
}

export default function TouristIdScreen() {
  const router = useRouter();
  const { identity } = useAuth();
  const [verification, setVerification] = useState<VerifyResult | null>(null);

  // Keep the blockchain status fresh ("Waiting" becomes "Verified" by itself).
  const touristId = identity?.touristId;
  useEffect(() => {
    if (!touristId) return;
    let alive = true;
    const load = async () => {
      const r = await verifyTourist(touristId);
      if (alive && r.ok) setVerification(r.data);
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [touristId]);

  if (!identity) return null; // signed out: the app is already redirecting

  const p = identity.profile;
  const status = verification?.status ?? "unverified";
  const revoked = status === "revoked";

  const share = async () => {
    const message = `My Digital Tourist ID: ${p.touristId}\nYou can verify it in the Trevora app.`;
    try {
      await Share.share({ message });
    } catch {
      notify("My Tourist ID", p.touristId);
    }
  };

  return (
    <Screen title="My Tourist ID" subtitle="Your digital identity">
      <BackButton />

      <Card style={styles.idCard}>
        <View style={styles.idHead}>
          <Text style={styles.idKicker}>Digital Tourist Identity</Text>
          <StatusBadge status={status} label={verification ? undefined : "Checking…"} />
        </View>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{p.fullName.trim()[0]?.toUpperCase() ?? "T"}</Text>
        </View>
        <Text style={styles.name}>{p.fullName}</Text>
        <Text style={styles.idNumber} accessibilityLabel={`Tourist ID ${p.touristId}`}>
          {p.touristId}
        </Text>
        <Text style={styles.meta}>Nationality: {p.nationality}</Text>

        <View style={[styles.qrWrap, revoked && { opacity: 0.3 }]} accessibilityLabel="QR code for verification">
          <QRCode value={qrPayload(p.touristId)} size={168} color="#42200F" backgroundColor="#FFFFFF" />
        </View>
        <Text style={styles.meta}>Registered: {formatDate(p.registeredAt)}</Text>
      </Card>

      <Card style={styles.chainCard}>
        <View style={styles.shield}>
          <Ionicons
            name={status === "verified" ? "shield-checkmark" : status === "failed" || revoked ? "warning" : "time"}
            size={26}
            color={status === "verified" ? theme.colors.success : status === "failed" || revoked ? theme.colors.coral : theme.colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chainTitle}>Blockchain Status</Text>
          <Text style={styles.chainPhrase}>{statusPhrase(verification)}</Text>
          {verification?.chain ? <Text style={styles.chainMeta}>(on {verification.chain.network})</Text> : null}
          {verification?.chain && (
            <>
              <Text style={styles.mono}>Fingerprint {shortHash(verification.chain.fingerprint)}</Text>
              {verification.chain.anchoredAt ? <Text style={styles.chainMeta}>Anchored {formatDateTime(verification.chain.anchoredAt)}</Text> : null}
              {verification.chain.txHash ? <Text style={styles.chainMeta}>Transaction {shortHash(verification.chain.txHash)}</Text> : null}
            </>
          )}
        </View>
      </Card>

      <Pressable onPress={() => void share()} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel="Share ID">
        <Ionicons name="share-social" size={20} color="#FFFFFF" />
        <Text style={styles.shareText}>Share ID</Text>
      </Pressable>

      <Action icon="scan" title="Verify my ID" sub="See exactly what a verifier sees" onPress={() => router.push({ pathname: "/verify", params: { id: p.touristId } })} />
      <Action icon="document-text" title="Travel records" sub="Bookings and permits, tamper-checked" onPress={() => router.push("/travel-records")} />
      <Action icon="medkit" title="Emergency sharing" sub="Choose who can see your emergency details" onPress={() => router.push("/emergency")} />

      <View style={{ height: 24 }} />
    </Screen>
  );
}

function Action({ icon, title, sub, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <Card style={styles.action}>
        <IconBadge name={icon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionSub}>{sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  idCard: { alignItems: "center", paddingVertical: 18 },
  idHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch", marginBottom: 14 },
  idKicker: { fontSize: 16, fontWeight: "800", color: theme.colors.ink },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { color: "#FFF3E8", fontSize: 40, fontWeight: "700", fontFamily: theme.fonts.serif },
  name: { fontSize: 24, fontWeight: "700", fontFamily: theme.fonts.serif, color: theme.colors.ink, textAlign: "center" },
  idNumber: { fontSize: 15, color: theme.colors.ink, marginTop: 4, letterSpacing: 0.4 },
  meta: { color: theme.colors.muted, fontSize: 14, marginTop: 4 },
  qrWrap: { backgroundColor: "#FFFFFF", padding: 12, borderRadius: 16, marginVertical: 16, borderWidth: 1, borderColor: theme.colors.border },

  chainCard: { flexDirection: "row", gap: 14, alignItems: "flex-start", backgroundColor: theme.colors.cardTint },
  shield: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.card, alignItems: "center", justifyContent: "center" },
  chainTitle: { fontWeight: "800", color: theme.colors.ink },
  chainPhrase: { color: theme.colors.ink, fontSize: 17, fontWeight: "700", marginTop: 2 },
  chainMeta: { color: theme.colors.muted, fontSize: 13, marginTop: 2 },
  mono: { fontFamily: "monospace", color: theme.colors.muted, fontSize: 12, marginTop: 8 },

  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 54, borderRadius: 27, backgroundColor: theme.colors.primary, marginBottom: 18 },
  shareText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },

  action: { flexDirection: "row", alignItems: "center", gap: 14 },
  actionTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.ink },
  actionSub: { color: theme.colors.muted, marginTop: 2, fontSize: 13 },
});
