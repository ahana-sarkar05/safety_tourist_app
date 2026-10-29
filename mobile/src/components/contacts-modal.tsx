import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { Contact, loadContacts, saveContacts } from "../utils/contacts";

type Props = { visible: boolean; onClose: () => void };

const MAX_CONTACTS = 5;

export default function ContactsModal({ visible, onClose }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (visible) loadContacts().then(setContacts);
  }, [visible]);

  const addContact = async () => {
    const cleanPhone = phone.replace(/[\s-]/g, "");
    if (!name.trim()) return Alert.alert("Enter a name");
    if (!/^\+?\d{7,15}$/.test(cleanPhone))
      return Alert.alert("Invalid number", "Use digits only, e.g. +919876543210");
    if (contacts.length >= MAX_CONTACTS)
      return Alert.alert(`Maximum ${MAX_CONTACTS} contacts`);

    const updated = [
      ...contacts,
      { id: Date.now().toString(), name: name.trim(), phone: cleanPhone },
    ];
    await saveContacts(updated);
    setContacts(updated);
    setName("");
    setPhone("");
  };

  const removeContact = async (id: string) => {
    const updated = contacts.filter((c) => c.id !== id);
    await saveContacts(updated);
    setContacts(updated);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Emergency contacts</Text>
        <Text style={styles.hint}>
          These people get your location when you press SOS. Include the country
          code (e.g. +91).
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone (+919876543210)"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addContact}>
          <Text style={styles.btnText}>Add contact</Text>
        </TouchableOpacity>

        <FlatList
          style={{ marginTop: 16 }}
          data={contacts}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={
            <Text style={styles.empty}>No contacts yet.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPhone}>{item.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => removeContact(item.id)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.btnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: "white" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 6 },
  hint: { color: "#6b7280", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  addBtn: {
    backgroundColor: "#16a34a",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  closeBtn: {
    backgroundColor: "#6b7280",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  btnText: { color: "white", fontWeight: "600" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 20 },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  itemName: { fontWeight: "600", fontSize: 16 },
  itemPhone: { color: "#6b7280" },
  remove: { color: "#e11d48", fontWeight: "600" },
});