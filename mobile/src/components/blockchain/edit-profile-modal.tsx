import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  TouristProfile,
  saveTouristProfile,
  reAnchorIdentity,
} from "../../utils/blockchain";
import { theme } from "../../constants/app-theme";

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  profile: TouristProfile;
  onSaved: () => Promise<void>;
}

export default function EditTouristProfileModal({
  visible,
  onClose,
  profile,
  onSaved,
}: EditProfileModalProps) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [nationality, setNationality] = useState(profile.nationality);
  const [passportNumber, setPassportNumber] = useState(profile.passportNumber);
  const [bloodGroup, setBloodGroup] = useState(profile.bloodGroup);
  const [allergies, setAllergies] = useState(profile.allergies);
  const [emergencyPhone, setEmergencyPhone] = useState(profile.emergencyPhone);
  const [loading, setLoading] = useState(false);

  const handleSaveAndReAnchor = async () => {
    if (!fullName.trim() || !passportNumber.trim()) {
      Alert.alert("Missing details", "Please enter full name and passport number.");
      return;
    }

    setLoading(true);
    try {
      const updated: TouristProfile = {
        ...profile,
        fullName: fullName.trim(),
        nationality: nationality.trim(),
        passportNumber: passportNumber.trim(),
        bloodGroup: bloodGroup.trim(),
        allergies: allergies.trim(),
        emergencyPhone: emergencyPhone.trim(),
      };
      await saveTouristProfile(updated);
      await reAnchorIdentity(updated);
      await onSaved();
      onClose();
      Alert.alert(
        "Updated & Re-Anchored",
        "Profile saved off-chain, and an updated cryptographic commitment was anchored into the blockchain."
      );
    } catch {
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Edit Tourist Profile</Text>
              <Text style={styles.subtitle}>
                Changes are stored off-chain and re-anchored
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.colors.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Abida Rahman"
            />

            <Text style={styles.label}>Nationality</Text>
            <TextInput
              style={styles.input}
              value={nationality}
              onChangeText={setNationality}
              placeholder="e.g. Indian"
            />

            <Text style={styles.label}>Passport / Govt ID Number (Off-Chain)</Text>
            <TextInput
              style={styles.input}
              value={passportNumber}
              onChangeText={setPassportNumber}
              placeholder="e.g. Z9482103K"
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Blood Group</Text>
                <TextInput
                  style={styles.input}
                  value={bloodGroup}
                  onChangeText={setBloodGroup}
                  placeholder="e.g. O+"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Emergency Phone</Text>
                <TextInput
                  style={styles.input}
                  value={emergencyPhone}
                  onChangeText={setEmergencyPhone}
                  placeholder="+91 98765 43210"
                />
              </View>
            </View>

            <Text style={styles.label}>Allergies</Text>
            <TextInput
              style={styles.input}
              value={allergies}
              onChangeText={setAllergies}
              placeholder="e.g. Penicillin"
            />

            <TouchableOpacity
              style={[styles.saveBtn, loading && { opacity: 0.7 }]}
              onPress={handleSaveAndReAnchor}
              disabled={loading}
            >
              <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                {loading ? "Mining Block..." : "Save & Re-Anchor to Chain"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  form: {
    paddingBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.ink,
    marginTop: 8,
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
  saveBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 18,
    marginBottom: 20,
    gap: 6,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
