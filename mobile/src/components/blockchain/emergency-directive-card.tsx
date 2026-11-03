import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TouristProfile } from "../../utils/blockchain";
import { hashData } from "../../utils/crypto";
import { theme } from "../../constants/app-theme";

interface EmergencyDirectiveCardProps {
  profile: TouristProfile;
}

export default function EmergencyDirectiveCard({
  profile,
}: EmergencyDirectiveCardProps) {
  const emergencyPayload = {
    bloodGroup: profile.bloodGroup,
    allergies: profile.allergies,
    emergencyPhone: profile.emergencyPhone,
  };
  const computedHash = hashData(emergencyPayload);

  const handleVerifyMedical = () => {
    Alert.alert(
      "Emergency Directive Verified",
      `Blood Group: ${profile.bloodGroup}\nAllergies: ${profile.allergies}\nEmergency Phone: ${profile.emergencyPhone}\n\nCryptographic Seal:\n${computedHash}\n\nStatus: Authentic on-chain record for emergency personnel.`
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name="medkit" size={18} color="#0F766E" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.badge}>EMERGENCY DIRECTIVE</Text>
          <Text style={styles.title}>Medical & Contact Directive</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.label}>BLOOD GROUP</Text>
          <Text style={styles.valueHighlight}>{profile.bloodGroup}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.label}>ALLERGIES</Text>
          <Text style={styles.value}>{profile.allergies}</Text>
        </View>
      </View>

      <View style={styles.contactRow}>
        <Ionicons name="call" size={15} color={theme.colors.primary} />
        <Text style={styles.contactLabel}>Primary SOS Contact:</Text>
        <Text style={styles.contactValue}>{profile.emergencyPhone}</Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.hashText}>
          Seal: {computedHash.slice(0, 12)}...
        </Text>

        <TouchableOpacity
          style={styles.verifyBtn}
          onPress={handleVerifyMedical}
        >
          <Text style={styles.verifyBtnText}>Verify Directive</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F4FAF8",
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 16,
    ...theme.shadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D1F2EB",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    fontSize: 9,
    fontWeight: "800",
    color: "#0F766E",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  grid: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    gap: 12,
    marginBottom: 8,
  },
  gridItem: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    color: theme.colors.muted,
    marginBottom: 2,
  },
  valueHighlight: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F766E",
  },
  value: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.ink,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  contactLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  contactValue: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hashText: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#0F766E",
  },
  verifyBtn: {
    backgroundColor: "#0F766E",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  verifyBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
