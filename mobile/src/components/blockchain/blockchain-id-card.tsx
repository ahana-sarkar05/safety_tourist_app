import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { TouristProfile } from "../../utils/blockchain";
import QrCode from "./qr-code";
import { theme } from "../../constants/app-theme";

interface BlockchainIdCardProps {
  profile: TouristProfile;
  isValid: boolean;
  blockNumber: number;
  onRefreshVerify?: () => void;
}

export default function BlockchainIdCard({
  profile,
  isValid,
  blockNumber,
}: BlockchainIdCardProps) {
  const [showQrModal, setShowQrModal] = useState(false);

  const truncatedDid =
    profile.did.length > 24
      ? `${profile.did.slice(0, 16)}...${profile.did.slice(-6)}`
      : profile.did;

  const verificationQrPayload = JSON.stringify({
    did: profile.did,
    id: profile.id,
    issuer: profile.issuer,
    block: blockNumber,
    validUntil: profile.expiresAt,
    protocol: "TOURIST_SAFETY_DID_V1",
  });

  return (
    <>
      <LinearGradient
        colors={
          isValid
            ? ["#2A160F", "#622919", "#9C3C21"]
            : ["#3F1D1D", "#7F1D1D", "#991B1B"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.sheenCircle} />

        <View style={styles.cardHeader}>
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <View style={styles.chipInner} />
            </View>
            <Ionicons
              name="wifi"
              size={18}
              color="#FFDFBA"
              style={{ transform: [{ rotate: "90deg" }] }}
            />
          </View>

          <View style={styles.networkBadge}>
            <View
              style={[
                styles.networkDot,
                { backgroundColor: isValid ? "#4ADE80" : "#F87171" },
              ]}
            />
            <Text style={styles.networkText}>
              {isValid ? "Polygon Sepolia" : "Integrity Flagged"}
            </Text>
          </View>
        </View>

        <Text style={styles.cardSubtitle}>INTERNATIONAL DIGITAL TOURIST ID</Text>
        <Text style={styles.holderName}>{profile.fullName}</Text>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>ID NUMBER</Text>
            <Text style={styles.metaValue}>{profile.id}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>NATIONALITY</Text>
            <Text style={styles.metaValue}>{profile.nationality}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>VALID UNTIL</Text>
            <Text style={styles.metaValue}>{profile.expiresAt}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.didLabel}>DECENTRALIZED IDENTIFIER (DID)</Text>
            <Text style={styles.didValue}>{truncatedDid}</Text>
            <Text style={styles.blockInfo}>
              {isValid
                ? `Block #${blockNumber} • Immutable Ledger`
                : "Verification Mismatch"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowQrModal(true)}
            style={styles.qrButton}
            accessibilityRole="button"
            accessibilityLabel="View Verification QR Code"
          >
            <QrCode
              value={verificationQrPayload}
              size={48}
              color="#2A160F"
              backgroundColor="#FFF8F3"
            />
            <Text style={styles.qrTapLabel}>QR Pass</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Verifiable Tourist DID</Text>
                <Text style={styles.modalSub}>
                  Official checkpoint & emergency pass
                </Text>
              </View>
              <Pressable
                onPress={() => setShowQrModal(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color={theme.colors.ink} />
              </Pressable>
            </View>

            <View style={styles.qrBox}>
              <QrCode
                value={verificationQrPayload}
                size={220}
                color="#2A160F"
                backgroundColor="#FFFFFF"
              />
            </View>

            <View style={styles.modalInfoBox}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Holder:</Text>
                <Text style={styles.infoValue}>{profile.fullName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>DID:</Text>
                <Text style={styles.infoValue}>{truncatedDid}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Block Anchor:</Text>
                <Text style={styles.infoValue}>Block #{blockNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Issuer:</Text>
                <Text style={styles.infoValue}>{profile.issuer}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setShowQrModal(false)}
              style={styles.doneBtn}
            >
              <Text style={styles.doneBtnText}>Close Pass</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#622919",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sheenCircle: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255, 220, 190, 0.12)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chip: {
    width: 34,
    height: 26,
    backgroundColor: "#FBBF24",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  chipInner: {
    width: 18,
    height: 14,
    backgroundColor: "#D97706",
    borderRadius: 3,
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 6,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  networkText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    color: "rgba(255, 230, 215, 0.75)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  holderName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: 14,
  },
  metaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 14,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    color: "rgba(255, 230, 215, 0.7)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  metaValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  didLabel: {
    color: "rgba(255, 230, 215, 0.7)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  didValue: {
    color: "#FFECD9",
    fontSize: 12,
    fontFamily: "monospace",
    fontWeight: "600",
    marginTop: 2,
  },
  blockInfo: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "500",
  },
  qrButton: {
    backgroundColor: "#FFFFFF",
    padding: 6,
    borderRadius: 12,
    alignItems: "center",
  },
  qrTapLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#622919",
    marginTop: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  modalSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  qrBox: {
    padding: 16,
    backgroundColor: "#FFF8F3",
    borderRadius: 16,
    marginBottom: 16,
  },
  modalInfoBox: {
    width: "100%",
    backgroundColor: "#FDF6F0",
    padding: 12,
    borderRadius: 14,
    gap: 6,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoLabel: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 12,
    color: theme.colors.ink,
    fontWeight: "700",
    maxWidth: "60%",
    textAlign: "right",
  },
  doneBtn: {
    backgroundColor: theme.colors.primary,
    width: "100%",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
