import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, IconBadge } from "../../components/ui";
import { theme } from "../../constants/app-theme";
import {
  TouristProfile,
  TravelRecord,
  BlockchainBlock,
  BlockchainTransaction,
  VerificationResult,
  getTouristProfile,
  getTravelRecords,
  getBlockchainBlocks,
  getBlockchainTransactions,
  verifyTouristIdentityIntegrity,
} from "../../utils/blockchain";
import BlockchainIdCard from "../../components/blockchain/blockchain-id-card";
import BlockchainVerificationPanel from "../../components/blockchain/blockchain-verification-panel";
import TravelRecordsList from "../../components/blockchain/travel-records-list";
import EmergencyDirectiveCard from "../../components/blockchain/emergency-directive-card";
import BlockExplorerModal from "../../components/blockchain/block-explorer-modal";
import EditTouristProfileModal from "../../components/blockchain/edit-profile-modal";
import { useAuth } from "../../context/auth-context";

export default function Profile() {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<TouristProfile | null>(null);
  const [records, setRecords] = useState<TravelRecord[]>([]);
  const [blocks, setBlocks] = useState<BlockchainBlock[]>([]);
  const [transactions, setTransactions] = useState<BlockchainTransaction[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  const [explorerVisible, setExplorerVisible] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);

  const confirmLogout = () => {
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm("Are you sure you want to log out of your Tourist ID?")
      ) {
        signOut();
      }
    } else {
      Alert.alert(
        "Log Out",
        "Are you sure you want to log out of your Tourist ID?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Log Out", style: "destructive", onPress: () => signOut() },
        ]
      );
    }
  };

  const loadData = useCallback(async () => {
    try {
      const p = await getTouristProfile();
      const r = await getTravelRecords();
      const b = await getBlockchainBlocks();
      const t = await getBlockchainTransactions();
      const v = await verifyTouristIdentityIntegrity(p);

      setProfile(p);
      setRecords(r);
      setBlocks(b);
      setTransactions(t);
      setVerification(v);
    } catch (err) {
      console.error("Error loading blockchain profile data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || !profile) {
    return (
      <Screen title="Tourist ID" subtitle="Loading ledger...">
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Synchronizing with TouristNet...</Text>
        </View>
      </Screen>
    );
  }

  const isValid = verification?.isValid ?? true;

  return (
    <Screen
      title="Tourist Identity & Records"
      subtitle="Blockchain-verified DID and credentials"
    >
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.explorerPill}
          onPress={() => setExplorerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Open Blockchain Block Explorer"
        >
          <Ionicons name="cube" size={15} color="#FFFFFF" />
          <Text style={styles.explorerPillText}>
            Block Explorer (#{blocks[blocks.length - 1]?.blockNumber || 1041})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editPill}
          onPress={() => setEditProfileVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Edit Profile"
        >
          <Ionicons name="create-outline" size={15} color={theme.colors.primary} />
          <Text style={styles.editPillText}>Edit Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutPill}
          onPress={confirmLogout}
          accessibilityRole="button"
          accessibilityLabel="Log Out"
        >
          <Ionicons name="log-out-outline" size={15} color={theme.colors.coral} />
          <Text style={styles.logoutPillText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <BlockchainIdCard
        profile={profile}
        isValid={isValid}
        blockNumber={verification?.blockNumber || 1041}
        onRefreshVerify={loadData}
      />

      <BlockchainVerificationPanel
        profile={profile}
        verification={verification}
        onRefresh={loadData}
      />

      <EmergencyDirectiveCard profile={profile} />

      <TravelRecordsList records={records} onRefresh={loadData} />

      <TouchableOpacity onPress={() => setExplorerVisible(true)}>
        <Card style={styles.explorerCard}>
          <IconBadge
            name="layers"
            bg="#1E293B"
            color="#38BDF8"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.explorerCardTitle}>Consortium Ledger</Text>
            <Text style={styles.explorerCardSub}>
              {blocks.length} blocks • {transactions.length} immutable transactions
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
        </Card>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={confirmLogout}
      >
        <Ionicons name="log-out-outline" size={16} color={theme.colors.coral} />
        <Text style={styles.signOutBtnText}>Sign Out / Switch Account</Text>
      </TouchableOpacity>

      <BlockExplorerModal
        visible={explorerVisible}
        onClose={() => setExplorerVisible(false)}
        blocks={blocks}
        transactions={transactions}
      />

      <EditTouristProfileModal
        visible={editProfileVisible}
        onClose={() => setEditProfileVisible(false)}
        profile={profile}
        onSaved={loadData}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerLoading: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: theme.colors.muted,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  explorerPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E293B",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 6,
  },
  explorerPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  editPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 4,
    ...theme.shadow,
  },
  editPillText: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  logoutPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 4,
  },
  logoutPillText: {
    color: theme.colors.coral,
    fontSize: 12,
    fontWeight: "700",
  },
  explorerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  explorerCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  explorerCardSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 6,
    marginBottom: 20,
    gap: 8,
  },
  signOutBtnText: {
    color: theme.colors.coral,
    fontSize: 13,
    fontWeight: "700",
  },
});
