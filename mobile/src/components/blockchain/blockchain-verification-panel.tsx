import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  TouristProfile,
  VerificationResult,
  simulateTamperIdentity,
  reAnchorIdentity,
  resetBlockchainDemo,
} from "../../utils/blockchain";
import { theme } from "../../constants/app-theme";

interface BlockchainVerificationPanelProps {
  profile: TouristProfile;
  verification: VerificationResult | null;
  onRefresh: () => Promise<void>;
}

export default function BlockchainVerificationPanel({
  profile,
  verification,
  onRefresh,
}: BlockchainVerificationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [tampering, setTampering] = useState(false);

  const isValid = verification?.isValid ?? true;

  const handleVerify = async () => {
    setLoading(true);
    await onRefresh();
    setTimeout(() => {
      setLoading(false);
    }, 300);
  };

  const handleSimulateTamper = async () => {
    setTampering(true);
    await simulateTamperIdentity();
    await onRefresh();
    setTampering(false);
    Alert.alert(
      "Data Tamper Simulated",
      "Modified 1 character off-chain. Notice how the SHA-256 hash immediately mismatches the blockchain anchor.",
      [{ text: "OK" }]
    );
  };

  const handleRestore = async () => {
    setLoading(true);
    await resetBlockchainDemo();
    await onRefresh();
    setLoading(false);
  };

  const handleReAnchor = async () => {
    setLoading(true);
    await reAnchorIdentity(profile);
    await onRefresh();
    setLoading(false);
    Alert.alert(
      "New Block Mined",
      "The modified identity was signed and anchored into the blockchain ledger."
    );
  };

  const truncate = (hash?: string) => {
    if (!hash) return "Pending...";
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.privacyBanner}>
        <Ionicons name="lock-closed" size={16} color="#0F766E" />
        <Text style={styles.privacySub}>
          Zero-Knowledge Privacy: Personal details stay private on your device. Only a mathematical SHA-256 hash is on-chain.
        </Text>
      </View>

      <View style={[styles.card, !isValid && styles.cardTampered]}>
        <View style={styles.headerRow}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isValid ? theme.colors.mint : theme.colors.coralSoft },
            ]}
          >
            <Ionicons
              name={isValid ? "shield-checkmark" : "warning"}
              size={20}
              color={isValid ? theme.colors.success : theme.colors.coral}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {isValid ? "Ledger Verification: Authentic" : "Tamper Detected"}
            </Text>
            <Text style={styles.subtitle}>
              {isValid
                ? "Credential matches immutable on-chain record"
                : "Hash mismatch: Data altered after anchoring"}
            </Text>
          </View>
        </View>

        <View style={styles.hashComparisonBox}>
          <View style={styles.hashRow}>
            <Text style={styles.hashLabel}>Local SHA-256</Text>
            <Text
              style={[
                styles.hashValue,
                !isValid && { color: theme.colors.coral, fontWeight: "700" },
              ]}
            >
              {truncate(verification?.computedHash)}
            </Text>
          </View>

          <View style={styles.hashRow}>
            <Text style={styles.hashLabel}>On-Chain Anchor</Text>
            <Text style={styles.hashValue}>{truncate(verification?.onChainHash)}</Text>
          </View>

          <View style={styles.hashRow}>
            <Text style={styles.hashLabel}>Block Height</Text>
            <Text style={styles.metaValue}>
              #{verification?.blockNumber || 1041}
            </Text>
          </View>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.verifyBtn]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="refresh" size={15} color="#FFFFFF" />
                <Text style={styles.verifyBtnText}>Verify Now</Text>
              </>
            )}
          </TouchableOpacity>

          {isValid ? (
            <TouchableOpacity
              style={[styles.btn, styles.tamperBtn]}
              onPress={handleSimulateTamper}
              disabled={tampering}
            >
              <Ionicons name="bug" size={15} color="#991B1B" />
              <Text style={styles.tamperBtnText}>Test Tamper Alert</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btn, styles.restoreBtn]}
              onPress={handleRestore}
            >
              <Ionicons name="arrow-undo" size={15} color="#0F766E" />
              <Text style={styles.restoreBtnText}>Restore Clean ID</Text>
            </TouchableOpacity>
          )}
        </View>

        {!isValid && (
          <TouchableOpacity
            style={styles.reAnchorBtn}
            onPress={handleReAnchor}
            disabled={loading}
          >
            <Ionicons name="link" size={15} color="#FFFFFF" />
            <Text style={styles.reAnchorBtnText}>
              Authorize & Mine New Block
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  privacyBanner: {
    flexDirection: "row",
    backgroundColor: "#E6F4F1",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  privacySub: {
    fontSize: 12,
    color: "#134E4A",
    flex: 1,
    lineHeight: 16,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    padding: 16,
    ...theme.shadow,
  },
  cardTampered: {
    backgroundColor: "#FFF5F5",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  hashComparisonBox: {
    backgroundColor: "#FBF1EA",
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
    gap: 6,
  },
  hashRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hashLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.muted,
  },
  hashValue: {
    fontSize: 11,
    fontFamily: "monospace",
    color: theme.colors.ink,
    fontWeight: "600",
  },
  metaValue: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 14,
    gap: 6,
  },
  verifyBtn: {
    backgroundColor: theme.colors.primary,
  },
  verifyBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  tamperBtn: {
    backgroundColor: "#FEE2E2",
  },
  tamperBtnText: {
    color: "#991B1B",
    fontSize: 13,
    fontWeight: "700",
  },
  restoreBtn: {
    backgroundColor: "#CCFBF1",
  },
  restoreBtnText: {
    color: "#0F766E",
    fontSize: 13,
    fontWeight: "700",
  },
  reAnchorBtn: {
    backgroundColor: "#1E293B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 14,
    marginTop: 8,
    gap: 6,
  },
  reAnchorBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
