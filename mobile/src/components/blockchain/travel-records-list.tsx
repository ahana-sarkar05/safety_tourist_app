import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  TravelRecord,
  anchorNewTravelRecord,
  verifyRecordIntegrity,
} from "../../utils/blockchain";
import { theme } from "../../constants/app-theme";

interface TravelRecordsListProps {
  records: TravelRecord[];
  onRefresh: () => Promise<void>;
}

export default function TravelRecordsList({
  records,
  onRefresh,
}: TravelRecordsListProps) {
  const [isMintModalVisible, setIsMintModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIssuer, setNewIssuer] = useState("");
  const [newZone, setNewZone] = useState("");
  const [loading, setLoading] = useState(false);

  const getCategoryIcon = (category: TravelRecord["category"]) => {
    switch (category) {
      case "Permit":
        return "trail-sign";
      case "Insurance":
        return "shield-half";
      case "Access Pass":
        return "qr-code";
      case "Medical Clearance":
        return "medkit";
      default:
        return "document-text";
    }
  };

  const handleVerifySingle = async (rec: TravelRecord) => {
    const result = await verifyRecordIntegrity(rec);
    if (result.isValid) {
      Alert.alert(
        "Record Verified Authentic",
        `${rec.title}\nIssuer: ${rec.issuer}\nBlock: #${rec.blockNumber}\nHash: ${rec.dataHash.slice(0, 16)}...\nStatus: Valid & Untampered`
      );
    } else {
      Alert.alert("Verification Failed", result.reason || "Record mismatch!");
    }
  };

  const handleCreateRecord = async () => {
    if (!newTitle.trim() || !newIssuer.trim()) {
      Alert.alert("Missing Details", "Please enter permit title and issuing authority.");
      return;
    }

    setLoading(true);
    try {
      await anchorNewTravelRecord({
        title: newTitle.trim(),
        category: "Permit",
        issuer: newIssuer.trim(),
        details: {
          permitCode: `PERM-${Math.floor(1000 + Math.random() * 9000)}`,
          zoneOrZoneArea: newZone.trim() || "Protected Tourist Buffer Zone",
          holderName: "Abida Rahman",
          authorizedActivities: "Restricted Exploration",
        },
      });
      await onRefresh();
      setIsMintModalVisible(false);
      setNewTitle("");
      setNewIssuer("");
      setNewZone("");
      Alert.alert(
        "Permit Anchored",
        "A SHA-256 fingerprint was generated and a new block was mined into the ledger."
      );
    } catch {
      Alert.alert("Error", "Could not anchor permit.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Travel Records & Permits</Text>
          <Text style={styles.sectionSub}>
            Tamper-resistant digital permits & insurance
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setIsMintModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Anchor New Travel Record"
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Anchor New</Text>
        </TouchableOpacity>
      </View>

      {records.map((rec) => (
        <View key={rec.id} style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.iconBox}>
              <Ionicons
                name={getCategoryIcon(rec.category)}
                size={20}
                color={theme.colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <Text style={styles.categoryBadge}>{rec.category.toUpperCase()}</Text>
                <View style={styles.blockBadge}>
                  <Text style={styles.blockBadgeText}>Block #{rec.blockNumber}</Text>
                </View>
              </View>
              <Text style={styles.recordTitle}>{rec.title}</Text>
              <Text style={styles.issuerText}>{rec.issuer}</Text>
            </View>
          </View>

          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Code</Text>
              <Text style={styles.detailValue}>{rec.details.permitCode}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Zone / Area</Text>
              <Text style={styles.detailValue}>{rec.details.zoneOrZoneArea}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Valid Until</Text>
              <Text style={styles.detailValue}>{rec.expiryDate}</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.hashPillText}>
              {rec.dataHash.slice(0, 10)}...{rec.dataHash.slice(-6)}
            </Text>

            <TouchableOpacity
              style={styles.verifySmallBtn}
              onPress={() => handleVerifySingle(rec)}
            >
              <Ionicons name="shield-checkmark" size={13} color="#0F766E" />
              <Text style={styles.verifySmallBtnText}>Verify On-Chain</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Modal
        visible={isMintModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMintModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Anchor Travel Permit</Text>
              <TouchableOpacity onPress={() => setIsMintModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.ink} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Permit Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Wildlife Sanctuary Pass"
              placeholderTextColor={theme.colors.muted}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.inputLabel}>Issuing Authority</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. State Forest & Tourism Dept"
              placeholderTextColor={theme.colors.muted}
              value={newIssuer}
              onChangeText={setNewIssuer}
            />

            <Text style={styles.inputLabel}>Zone / Sector</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. High Altitude Sector 4B"
              placeholderTextColor={theme.colors.muted}
              value={newZone}
              onChangeText={setNewZone}
            />

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleCreateRecord}
              disabled={loading}
            >
              <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>
                {loading ? "Mining Block..." : "Sign & Mine into Blockchain"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  sectionSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 10,
    ...theme.shadow,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginBottom: 2,
  },
  categoryBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  blockBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  blockBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#4B5563",
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  issuerText: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 1,
  },
  cardDetails: {
    backgroundColor: "#FAF2EC",
    borderRadius: 12,
    padding: 10,
    gap: 4,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 11,
    color: theme.colors.ink,
    fontWeight: "700",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hashPillText: {
    fontSize: 10,
    fontFamily: "monospace",
    color: theme.colors.muted,
  },
  verifySmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E6F4F1",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  verifySmallBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F766E",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.ink,
    marginTop: 4,
  },
  input: {
    backgroundColor: "#FAF2EC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.ink,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 12,
    gap: 6,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
