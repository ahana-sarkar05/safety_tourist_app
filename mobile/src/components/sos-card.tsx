import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Vibration,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/app-theme";
import { useLocation } from "../context/location-context";
import { loadContacts } from "../utils/contacts";
import { sendSOS } from "../utils/sos";

// Seconds to wait (with a big Cancel button) before the SOS goes out.
// This stops a tap in your pocket from alarming your family.
// Set it to 0 if you want the SOS to send the instant you tap.
const COUNTDOWN_SECONDS = 3;

const AMBER = "#D98A1F";

type Phase =
  | { kind: "idle" }
  | { kind: "countdown"; left: number };

export default function SosCard() {
  const router = useRouter();
  const { location, accuracy } = useLocation();

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [contactCount, setContactCount] = useState<number | null>(null);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hereRef = useRef({ coord: location, accuracy });

  useEffect(() => {
    hereRef.current = { coord: location, accuracy };
  }, [location, accuracy]);

  // Refresh the contact count whenever Home comes back into view.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadContacts().then((c) => {
        if (alive) setContactCount(c.length);
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

const send = useCallback(async () => {
  clearTimer();
  setPhase({ kind: "idle" });
  Vibration.vibrate(250);

  await sendSOS({
    fallback: hereRef.current.coord,
    onNeedContacts: () => router.navigate("/safety"),
  });
}, [clearTimer, router]);

  const begin = () => {
    if (phase.kind !== "idle") return;

    if (COUNTDOWN_SECONDS <= 0) {
      void send();
      return;
    }

    let left = COUNTDOWN_SECONDS;
    setPhase({ kind: "countdown", left });
    Vibration.vibrate(80);
    timer.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        void send();
        return;
      }
      Vibration.vibrate(80);
      setPhase({ kind: "countdown", left });
    }, 1000);
  };

  const dismiss = () => {
    clearTimer();
    setPhase({ kind: "idle" });
  };

  const goAddContacts = () => {
    dismiss();
    router.navigate("/safety");
  };

  const noContacts = contactCount === 0;

  return (
    <>
      <Pressable
        onPress={begin}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel="Emergency SOS. Alerts your emergency contacts with your location."
      >
        <View style={styles.circle}>
          <Text style={styles.circleText}>SOS</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Emergency SOS</Text>
          <Text style={styles.sub}>
            {noContacts
              ? "Add a contact first so we know who to alert."
              : "Tap to alert your emergency contacts with your live location."}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6B4A3E" />
      </Pressable>

      <Modal
        visible={phase.kind !== "idle"}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            {phase.kind === "countdown" && (
              <>
                <Text style={styles.kicker}>Sending SOS in</Text>
                <Text style={styles.count}>{phase.left}</Text>
                <Text style={styles.hint}>
                  Your contacts will get your location. Tap Cancel if this was
                  a mistake.
                </Text>
                <View style={styles.row}>
                  <ModalButton grow label="Cancel" tone="outline" onPress={dismiss} />
                  <ModalButton grow label="Send now" tone="danger" onPress={() => void send()} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function Badge({
  icon,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
      <Ionicons name={icon} size={38} color={color} />
    </View>
  );
}

function ModalButton({
  label,
  tone,
  onPress,
  grow,
}: {
  label: string;
  tone: "primary" | "danger" | "outline" | "plain";
  onPress: () => void;
  grow?: boolean;
}) {
  const bg =
    tone === "primary"
      ? theme.colors.primary
      : tone === "danger"
        ? theme.colors.coral
        : "transparent";
  const border = tone === "outline" ? theme.colors.border : "transparent";
  const color =
    tone === "primary" || tone === "danger"
      ? "#FFFFFF"
      : tone === "plain"
        ? theme.colors.muted
        : theme.colors.ink;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        grow && { flex: 1 },
        { backgroundColor: bg, borderColor: border },
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.coralSoft,
  },
  cardPressed: { opacity: 0.85 },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  circleText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  title: { fontSize: 17, fontWeight: "800", color: theme.colors.ink },
  sub: { fontSize: 13, color: "#6B4A3E", marginTop: 2, lineHeight: 18 },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(59,31,22,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: theme.colors.card,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
  },
  center: { alignItems: "center", width: "100%", gap: 8 },
  kicker: { fontSize: 16, fontWeight: "700", color: theme.colors.muted },
  count: {
    fontSize: 88,
    fontWeight: "800",
    color: theme.colors.coral,
    lineHeight: 100,
  },
  hint: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  row: { flexDirection: "row", gap: 10, marginTop: 18, width: "100%" },
  column: { gap: 10, marginTop: 14, width: "100%" },
  sendingTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.ink,
    marginTop: 8,
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.ink,
    textAlign: "center",
  },
  note: { fontSize: 13, color: theme.colors.muted, textAlign: "center" },
  failList: { gap: 4, width: "100%", marginTop: 4 },
  failItem: { fontSize: 13, color: theme.colors.coral, textAlign: "center" },
  button: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 15, fontWeight: "700" },
});