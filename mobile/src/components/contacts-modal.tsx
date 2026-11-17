import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, IconBadge, SectionLabel } from "./ui";
import { theme } from "../constants/app-theme";
import {
  Contact,
  MAX_CONTACTS,
  hasCountryCode,
  initials,
  isValidPhone,
  loadContacts,
  newContactId,
  normalizePhone,
  samePhone,
  saveContacts,
} from "../utils/contacts";
import { pickFromPhonebook, type PhonebookNumber } from "../utils/phonebook";
import { confirm, notify } from "../utils/dialog";

type Props = { visible: boolean; onClose: () => void };

// A phonebook contact with several numbers: the person picks which one to use.
type Choosing = { name: string; phones: PhonebookNumber[] };

export default function ContactsModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [choosing, setChoosing] = useState<Choosing | null>(null);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    loadContacts().then((c) => {
      if (alive) setContacts(c);
    });
    return () => {
      alive = false;
    };
  }, [visible]);

  const close = () => {
    setChoosing(null);
    onClose();
  };

  const full = contacts.length >= MAX_CONTACTS;

  // Single place that validates and saves, used by both typing and the phonebook.
  const add = async (rawName: string, rawPhone: string): Promise<boolean> => {
    const cleanName = rawName.trim();
    const cleanPhone = normalizePhone(rawPhone);

    if (!cleanName) {
      notify("Enter a name");
      return false;
    }
    if (!isValidPhone(cleanPhone)) {
      notify("Invalid number", "Use digits only, e.g. +919876543210");
      return false;
    }
    if (contacts.length >= MAX_CONTACTS) {
      notify(`Maximum ${MAX_CONTACTS} contacts`);
      return false;
    }
    const dupe = contacts.find((c) => samePhone(c.phone, cleanPhone));
    if (dupe) {
      notify("Already added", `${dupe.name} already has this number.`);
      return false;
    }

    const updated = [
      ...contacts,
      { id: newContactId(), name: cleanName, phone: cleanPhone },
    ];
    await saveContacts(updated);
    setContacts(updated);
    return true;
  };

  const addManual = async () => {
    if (await add(name, phone)) {
      setName("");
      setPhone("");
    }
  };

  const fromPhonebook = async () => {
    const result = await pickFromPhonebook();

    switch (result.kind) {
      case "picked": {
        if (result.phones.length === 0) {
          notify("No phone number", `${result.name} doesn't have a phone number saved.`);
        } else if (result.phones.length === 1) {
          await add(result.name, result.phones[0].number);
        } else {
          setChoosing({ name: result.name, phones: result.phones });
        }
        return;
      }
      case "denied":
        Alert.alert(
          "Contacts access is off",
          "You can still type a name and number below, or allow access in Settings to pick from your phonebook.",
          [
            { text: "Type it in", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ]
        );
        return;
      case "unavailable":
        notify("Phonebook not available", "Type a name and number below instead.");
        return;
      case "cancelled":
        return;
    }
  };

  const chooseNumber = async (number: string) => {
    if (!choosing) return;
    if (await add(choosing.name, number)) setChoosing(null);
  };

  const remove = async (c: Contact) => {
    const ok = await confirm({
      title: `Remove ${c.name}?`,
      message: "They won't get your SOS any more.",
      confirmText: "Remove",
      cancelText: "Keep",
      destructive: true,
    });
    if (!ok) return;
    const updated = contacts.filter((x) => x.id !== c.id);
    await saveContacts(updated);
    setContacts(updated);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingHorizontal: 20,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Emergency contacts</Text>
              <Text style={styles.subtitle}>
                These people get a link to follow your live location when you press SOS.
              </Text>
            </View>
            <Pressable
              onPress={close}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={theme.colors.ink} />
            </Pressable>
          </View>

          {choosing ? (
            <Card>
              <Text style={styles.chooseTitle}>Which number for {choosing.name}?</Text>
              {choosing.phones.map((p) => (
                <Pressable
                  key={p.number}
                  onPress={() => void chooseNumber(p.number)}
                  style={({ pressed }) => [styles.numberRow, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${p.label} ${p.number}`}
                >
                  <Ionicons name="call" size={18} color={theme.colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.numberText}>{p.number}</Text>
                    <Text style={styles.numberLabel}>{p.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
                </Pressable>
              ))}
              <Pressable onPress={() => setChoosing(null)} style={styles.textBtn}>
                <Text style={styles.textBtnLabel}>Cancel</Text>
              </Pressable>
            </Card>
          ) : (
            <>
              {Platform.OS !== "web" && (
                <Pressable
                  onPress={() => void fromPhonebook()}
                  disabled={full}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    full && styles.disabled,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Choose from phonebook"
                >
                  <Ionicons name="book" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Choose from phonebook</Text>
                </Pressable>
              )}

              <Text style={styles.or}>
                {Platform.OS !== "web" ? "or add one manually" : "Add a contact"}
              </Text>

              <Card>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  placeholderTextColor={theme.colors.muted}
                  value={name}
                  onChangeText={setName}
                  editable={!full}
                  autoCapitalize="words"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Phone (+919876543210)"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  editable={!full}
                />
                <Text style={styles.helper}>
                  Include the country code (e.g. +91) so it works from anywhere in the world.
                </Text>
                <Pressable
                  onPress={() => void addManual()}
                  disabled={full}
                  style={({ pressed }) => [
                    styles.softBtn,
                    full && styles.disabled,
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Add contact"
                >
                  <Text style={styles.softBtnText}>Add contact</Text>
                </Pressable>
              </Card>
            </>
          )}

          <View style={styles.listHead}>
            <SectionLabel>Your contacts</SectionLabel>
            <View style={styles.count}>
              <Text style={styles.countText}>
                {contacts.length} / {MAX_CONTACTS}
              </Text>
            </View>
          </View>

          {contacts.length === 0 ? (
            <Card style={styles.empty}>
              <IconBadge name="people" bg={theme.colors.coralSoft} color={theme.colors.coral} />
              <Text style={styles.emptyTitle}>No contacts yet</Text>
              <Text style={styles.emptySub}>Add someone who should know when you need help.</Text>
            </Card>
          ) : (
            contacts.map((c) => (
              <Card key={c.id} style={styles.contactRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(c.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactPhone}>{c.phone}</Text>
                  {!hasCountryCode(c.phone) && (
                    <Text style={styles.warn}>No country code, may not reach from abroad</Text>
                  )}
                </View>
                <Pressable
                  onPress={() => void remove(c)}
                  style={styles.trash}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${c.name}`}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.coral} />
                </Pressable>
              </Card>
            ))
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            onPress={close}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.primaryBtnText}>Done</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "800", color: theme.colors.ink },
  subtitle: { fontSize: 15, color: theme.colors.muted, marginTop: 4, lineHeight: 21 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow,
  },

  primaryBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  softBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  softBtnText: { color: theme.colors.primary, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.4 },

  or: {
    textAlign: "center",
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "600",
    marginVertical: 16,
  },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.ink,
    marginBottom: 10,
  },
  helper: { fontSize: 12, color: theme.colors.muted, marginBottom: 10, lineHeight: 17 },

  chooseTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.ink, marginBottom: 8 },
  numberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  numberText: { fontSize: 16, fontWeight: "600", color: theme.colors.ink },
  numberLabel: { fontSize: 12, color: theme.colors.muted, marginTop: 1, textTransform: "capitalize" },
  textBtn: { alignItems: "center", paddingTop: 14 },
  textBtnLabel: { color: theme.colors.muted, fontWeight: "700" },

  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  count: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  countText: { color: theme.colors.primary, fontWeight: "700", fontSize: 12 },

  empty: { alignItems: "center", paddingVertical: 28, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.ink, marginTop: 8 },
  emptySub: { color: theme.colors.muted, textAlign: "center" },

  contactRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  contactName: { fontSize: 16, fontWeight: "700", color: theme.colors.ink },
  contactPhone: { color: theme.colors.muted, marginTop: 2 },
  warn: { color: theme.colors.primary, fontSize: 12, marginTop: 4, fontWeight: "600" },
  trash: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.coralSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: theme.colors.bg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});
