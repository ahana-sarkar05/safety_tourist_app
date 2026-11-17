import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BlockchainBlock,
  BlockchainTransaction,
} from "../../utils/blockchain";
import { theme } from "../../constants/app-theme";

interface BlockExplorerModalProps {
  visible: boolean;
  onClose: () => void;
  blocks: BlockchainBlock[];
  transactions: BlockchainTransaction[];
}

export default function BlockExplorerModal({
  visible,
  onClose,
  blocks,
  transactions,
}: BlockExplorerModalProps) {
  const [activeTab, setActiveTab] = useState<"blocks" | "txs">("blocks");
  const [selectedBlock, setSelectedBlock] = useState<BlockchainBlock | null>(null);

  const truncate = (hash?: string) => {
    if (!hash) return "";
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.cubeIcon}>
              <Ionicons name="cube" size={18} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Block Explorer</Text>
              <Text style={styles.headerSubtitle}>
                Consortium Safety Ledger • Polygon Sepolia Sync
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={theme.colors.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.metricsBar}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>BLOCK HEIGHT</Text>
            <Text style={styles.metricValue}>
              #{blocks[blocks.length - 1]?.blockNumber || 1041}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>TRANSACTIONS</Text>
            <Text style={styles.metricValue}>{transactions.length}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>CONSENSUS</Text>
            <Text style={styles.metricValue}>Proof-of-Authority</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, activeTab === "blocks" && styles.tabActive]}
            onPress={() => setActiveTab("blocks")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "blocks" && styles.tabTextActive,
              ]}
            >
              Blocks ({blocks.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === "txs" && styles.tabActive]}
            onPress={() => setActiveTab("txs")}
          >
            <Text
              style={[styles.tabText, activeTab === "txs" && styles.tabTextActive]}
            >
              Transactions ({transactions.length})
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {activeTab === "blocks" ? (
            <View style={styles.list}>
              {blocks
                .slice()
                .reverse()
                .map((b) => (
                  <TouchableOpacity
                    key={b.blockNumber}
                    style={styles.blockCard}
                    onPress={() => setSelectedBlock(b)}
                  >
                    <View style={styles.blockTopRow}>
                      <View style={styles.blockBadge}>
                        <Ionicons name="cube-outline" size={14} color="#B5532F" />
                        <Text style={styles.blockNumber}>Block #{b.blockNumber}</Text>
                      </View>
                      <Text style={styles.timeText}>
                        {new Date(b.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>

                    <View style={styles.hashDetailRow}>
                      <Text style={styles.hashLabel}>Hash:</Text>
                      <Text style={styles.hashVal}>{truncate(b.blockHash)}</Text>
                    </View>
                    <View style={styles.hashDetailRow}>
                      <Text style={styles.hashLabel}>Merkle Root:</Text>
                      <Text style={styles.hashVal}>{truncate(b.merkleRoot)}</Text>
                    </View>
                    <View style={styles.hashDetailRow}>
                      <Text style={styles.hashLabel}>Transactions:</Text>
                      <Text style={styles.hashVal}>
                        {b.transactions.length} confirmed
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          ) : (
            <View style={styles.list}>
              {transactions
                .slice()
                .reverse()
                .map((tx) => (
                  <View key={tx.txHash} style={styles.txCard}>
                    <View style={styles.txTopRow}>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{tx.type}</Text>
                      </View>
                      <Text style={styles.txStatus}>CONFIRMED</Text>
                    </View>

                    <Text style={styles.txHashTitle}>
                      Tx: {truncate(tx.txHash)}
                    </Text>

                    <View style={styles.txMetaBox}>
                      <Text style={styles.txMetaText}>
                        Block: #{tx.blockNumber} • Gas: {tx.gasUsed}
                      </Text>
                      <Text style={styles.txMetaText}>
                        Issuer: {tx.issuer}
                      </Text>
                      <Text style={styles.txMetaText}>
                        Anchor Hash: {truncate(tx.dataHash)}
                      </Text>
                    </View>
                  </View>
                ))}
            </View>
          )}
        </ScrollView>

        {selectedBlock && (
          <Modal
            visible={!!selectedBlock}
            transparent
            animationType="fade"
            onRequestClose={() => setSelectedBlock(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.detailBox}>
                <View style={styles.detailBoxHeader}>
                  <Text style={styles.detailBoxTitle}>
                    Block #{selectedBlock.blockNumber}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedBlock(null)}>
                    <Ionicons name="close" size={22} color={theme.colors.ink} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 360 }}>
                  <Text style={styles.fieldLabel}>Block Hash</Text>
                  <Text style={styles.fieldMono}>{selectedBlock.blockHash}</Text>

                  <Text style={styles.fieldLabel}>Previous Hash</Text>
                  <Text style={styles.fieldMono}>{selectedBlock.previousHash}</Text>

                  <Text style={styles.fieldLabel}>Merkle Root</Text>
                  <Text style={styles.fieldMono}>{selectedBlock.merkleRoot}</Text>

                  <Text style={styles.fieldLabel}>Validator Address</Text>
                  <Text style={styles.fieldMono}>{selectedBlock.validator}</Text>

                  <Text style={styles.fieldLabel}>Timestamp</Text>
                  <Text style={styles.fieldValue}>{selectedBlock.timestamp}</Text>

                  <Text style={styles.fieldLabel}>
                    Transactions ({selectedBlock.transactions.length})
                  </Text>
                  {selectedBlock.transactions.map((t, idx) => (
                    <View key={idx} style={styles.subTxItem}>
                      <Text style={styles.subTxType}>{t.type}</Text>
                      <Text style={styles.fieldMono}>{t.txHash}</Text>
                      <Text style={styles.subTxTarget}>
                        Anchor Hash: {t.dataHash}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFBF7",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cubeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  headerSubtitle: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  closeBtn: {
    padding: 6,
  },
  metricsBar: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  metricItem: {
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: "#FFFFFF",
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  list: {
    gap: 10,
    paddingBottom: 40,
  },
  blockCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    ...theme.shadow,
  },
  blockTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  blockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  blockNumber: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  timeText: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  hashDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  hashLabel: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  hashVal: {
    fontSize: 11,
    fontFamily: "monospace",
    color: theme.colors.ink,
    fontWeight: "600",
  },
  txCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    ...theme.shadow,
  },
  txTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  typeBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#4338CA",
  },
  txStatus: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
  },
  txHashTitle: {
    fontSize: 12,
    fontFamily: "monospace",
    fontWeight: "700",
    color: theme.colors.ink,
    marginBottom: 6,
  },
  txMetaBox: {
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 10,
    gap: 2,
  },
  txMetaText: {
    fontSize: 11,
    color: "#64748B",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  detailBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    ...theme.shadow,
  },
  detailBoxHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  detailBoxTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.muted,
    marginTop: 8,
    marginBottom: 2,
  },
  fieldMono: {
    fontSize: 11,
    fontFamily: "monospace",
    color: theme.colors.ink,
    backgroundColor: "#F1F5F9",
    padding: 6,
    borderRadius: 8,
  },
  fieldValue: {
    fontSize: 12,
    color: theme.colors.ink,
  },
  subTxItem: {
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 10,
    marginTop: 6,
  },
  subTxType: {
    fontSize: 10,
    fontWeight: "800",
    color: "#4338CA",
    marginBottom: 2,
  },
  subTxTarget: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#059669",
    marginTop: 2,
  },
});
