import AsyncStorage from "@react-native-async-storage/async-storage";
import { hashData, sha256 } from "./crypto";

export interface TouristProfile {
  id: string;
  fullName: string;
  nationality: string;
  passportNumber: string;
  dateOfBirth: string;
  bloodGroup: string;
  allergies: string;
  emergencyPhone: string;
  walletAddress: string;
  did: string;
  issuedAt: string;
  expiresAt: string;
  issuer: string;
  email?: string;
}

export interface TravelRecord {
  id: string;
  title: string;
  category: "Permit" | "Insurance" | "Access Pass" | "Medical Clearance";
  issuer: string;
  issueDate: string;
  expiryDate: string;
  details: {
    permitCode: string;
    zoneOrZoneArea: string;
    holderName: string;
    coverageLimit?: string;
    authorizedActivities?: string;
  };
  dataHash: string;
  txHash: string;
  blockNumber: number;
  status: "VALID" | "TAMPERED" | "REVOKED";
}

export interface BlockchainTransaction {
  txHash: string;
  blockNumber: number;
  timestamp: string;
  from: string;
  type: "IDENTITY_MINT" | "RECORD_ANCHOR" | "EMERGENCY_DIRECTIVE";
  did: string;
  dataHash: string;
  issuer: string;
  gasUsed: number;
  status: "CONFIRMED";
}

export interface BlockchainBlock {
  blockNumber: number;
  timestamp: string;
  previousHash: string;
  blockHash: string;
  merkleRoot: string;
  validator: string;
  transactions: BlockchainTransaction[];
}

export interface VerificationResult {
  isValid: boolean;
  computedHash: string;
  onChainHash: string;
  blockNumber: number;
  txHash: string;
  timestamp: string;
  issuer: string;
  reason?: string;
}

const STORAGE_KEYS = {
  PROFILE: "@tourist_profile_v1",
  RECORDS: "@tourist_travel_records_v1",
  BLOCKS: "@tourist_blockchain_blocks_v1",
  TXS: "@tourist_blockchain_txs_v1",
};

const DEFAULT_WALLET = {
  address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  did: "did:tourist:0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
};

export const INITIAL_TOURIST_PROFILE: TouristProfile = {
  id: "T-892401",
  fullName: "Abida Rahman",
  nationality: "Indian",
  passportNumber: "Z9482103K",
  dateOfBirth: "1998-05-14",
  bloodGroup: "O+",
  allergies: "None Reported",
  emergencyPhone: "+91 98765 43210",
  walletAddress: DEFAULT_WALLET.address,
  did: DEFAULT_WALLET.did,
  issuedAt: "2026-03-15",
  expiresAt: "2027-03-15",
  issuer: "National Tourism & Safety Protocol Authority",
  email: "abida.rahman@travelsafety.io",
};

export const INITIAL_TRAVEL_RECORDS: TravelRecord[] = [];

export async function initializeBlockchainState(): Promise<{
  profile: TouristProfile;
  records: TravelRecord[];
  blocks: BlockchainBlock[];
  transactions: BlockchainTransaction[];
}> {
  try {
    const rawProfile = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
    const rawRecords = await AsyncStorage.getItem(STORAGE_KEYS.RECORDS);
    const rawBlocks = await AsyncStorage.getItem(STORAGE_KEYS.BLOCKS);
    const rawTxs = await AsyncStorage.getItem(STORAGE_KEYS.TXS);

    if (rawProfile && rawBlocks && rawTxs) {
      // Filter out any leftover mock records
      const parsedRecords: TravelRecord[] = rawRecords ? JSON.parse(rawRecords) : [];
      const cleanRecords = parsedRecords.filter(
        (r) =>
          !r.id.startsWith("REC-TREK") &&
          !r.id.startsWith("REC-HERITAGE") &&
          !r.id.startsWith("REC-INS")
      );
      if (cleanRecords.length !== parsedRecords.length || rawRecords !== JSON.stringify(cleanRecords)) {
        await AsyncStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(cleanRecords));
      }

      // Filter out any mock record transactions
      const parsedTxs: BlockchainTransaction[] = JSON.parse(rawTxs);
      const cleanTxs = parsedTxs.filter(
        (tx) =>
          tx.type !== "RECORD_ANCHOR" ||
          (!tx.txHash.includes("REC-TREK") &&
            !tx.txHash.includes("REC-HERITAGE") &&
            !tx.txHash.includes("REC-INS"))
      );
      if (cleanTxs.length !== parsedTxs.length) {
        await AsyncStorage.setItem(STORAGE_KEYS.TXS, JSON.stringify(cleanTxs));
      }

      // Filter out any mock record blocks
      const parsedBlocks: BlockchainBlock[] = JSON.parse(rawBlocks);
      const cleanBlocks = parsedBlocks.filter((b) => {
        if (b.blockNumber === 0 || b.blockNumber === 1041) return true;
        return b.transactions.some((tx) => cleanTxs.some((cx) => cx.txHash === tx.txHash));
      });
      if (cleanBlocks.length !== parsedBlocks.length) {
        await AsyncStorage.setItem(STORAGE_KEYS.BLOCKS, JSON.stringify(cleanBlocks));
      }

      return {
        profile: JSON.parse(rawProfile),
        records: cleanRecords,
        blocks: cleanBlocks,
        transactions: cleanTxs,
      };
    }

    const profile = { ...INITIAL_TOURIST_PROFILE };
    const identityPayload = {
      id: profile.id,
      fullName: profile.fullName,
      nationality: profile.nationality,
      passportNumber: profile.passportNumber,
      dateOfBirth: profile.dateOfBirth,
      walletAddress: profile.walletAddress,
    };
    const identityDataHash = hashData(identityPayload);

    const idTx: BlockchainTransaction = {
      txHash: sha256(`TX_ID_${profile.did}_${Date.now()}`),
      blockNumber: 1041,
      timestamp: "2026-10-20T10:00:00.000Z",
      from: "0x89D24A6b4C1185449A0b938fFFf4c718a20cD810",
      type: "IDENTITY_MINT",
      did: profile.did,
      dataHash: identityDataHash,
      issuer: profile.issuer,
      gasUsed: 42100,
      status: "CONFIRMED",
    };

    const emergencyPayload = {
      bloodGroup: profile.bloodGroup,
      allergies: profile.allergies,
      emergencyPhone: profile.emergencyPhone,
    };
    const emergencyHash = hashData(emergencyPayload);
    const emergencyTx: BlockchainTransaction = {
      txHash: sha256(`TX_EMERGENCY_${profile.did}_${Date.now()}`),
      blockNumber: 1041,
      timestamp: "2026-10-20T10:00:02.000Z",
      from: profile.walletAddress,
      type: "EMERGENCY_DIRECTIVE",
      did: profile.did,
      dataHash: emergencyHash,
      issuer: "Tourist Self-Signed Anchor",
      gasUsed: 21500,
      status: "CONFIRMED",
    };

    const genesisBlock: BlockchainBlock = {
      blockNumber: 0,
      timestamp: "2026-01-01T00:00:00.000Z",
      previousHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      blockHash: sha256("GENESIS_SAFETY_TOURIST_CHAIN_2026"),
      merkleRoot: sha256("MERKLE_ROOT_0"),
      validator: "0x0000000000000000000000000000000000000000",
      transactions: [],
    };

    const block1041: BlockchainBlock = {
      blockNumber: 1041,
      timestamp: "2026-10-20T10:00:05.000Z",
      previousHash: sha256("BLOCK_1040"),
      blockHash: sha256(`BLOCK_1041_${idTx.txHash}`),
      merkleRoot: sha256(idTx.dataHash + emergencyTx.dataHash),
      validator: "0x89D24A6b4C1185449A0b938fFFf4c718a20cD810",
      transactions: [idTx, emergencyTx],
    };

    const allBlocks = [genesisBlock, block1041];
    const allTxs = [idTx, emergencyTx];

    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    await AsyncStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify([]));
    await AsyncStorage.setItem(STORAGE_KEYS.BLOCKS, JSON.stringify(allBlocks));
    await AsyncStorage.setItem(STORAGE_KEYS.TXS, JSON.stringify(allTxs));

    return {
      profile,
      records: [],
      blocks: allBlocks,
      transactions: allTxs,
    };
  } catch (error) {
    console.error("Failed to initialize blockchain state:", error);
    return {
      profile: INITIAL_TOURIST_PROFILE,
      records: INITIAL_TRAVEL_RECORDS,
      blocks: [],
      transactions: [],
    };
  }
}

export async function getTouristProfile(): Promise<TouristProfile> {
  const state = await initializeBlockchainState();
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
  return raw ? JSON.parse(raw) : state.profile;
}

export async function saveTouristProfile(profile: TouristProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
}

export async function getTravelRecords(): Promise<TravelRecord[]> {
  const state = await initializeBlockchainState();
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.RECORDS);
  return raw ? JSON.parse(raw) : state.records;
}

export async function getBlockchainBlocks(): Promise<BlockchainBlock[]> {
  const state = await initializeBlockchainState();
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.BLOCKS);
  return raw ? JSON.parse(raw) : state.blocks;
}

export async function getBlockchainTransactions(): Promise<BlockchainTransaction[]> {
  const state = await initializeBlockchainState();
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.TXS);
  return raw ? JSON.parse(raw) : state.transactions;
}

export async function verifyTouristIdentityIntegrity(
  profile: TouristProfile
): Promise<VerificationResult> {
  const txs = await getBlockchainTransactions();
  const idTx = txs.find((t) => t.type === "IDENTITY_MINT" && t.did === profile.did);

  if (!idTx) {
    return {
      isValid: false,
      computedHash: "",
      onChainHash: "",
      blockNumber: 0,
      txHash: "",
      timestamp: "",
      issuer: "",
      reason: "No on-chain identity anchor found",
    };
  }

  const currentPayload = {
    id: profile.id,
    fullName: profile.fullName,
    nationality: profile.nationality,
    passportNumber: profile.passportNumber,
    dateOfBirth: profile.dateOfBirth,
    walletAddress: profile.walletAddress,
  };
  const computedHash = hashData(currentPayload);
  const isValid = computedHash.toLowerCase() === idTx.dataHash.toLowerCase();

  return {
    isValid,
    computedHash,
    onChainHash: idTx.dataHash,
    blockNumber: idTx.blockNumber,
    txHash: idTx.txHash,
    timestamp: idTx.timestamp,
    issuer: idTx.issuer,
    reason: isValid
      ? "Tamper verification passed."
      : "Tamper detected: local data does not match on-chain hash.",
  };
}

export async function verifyRecordIntegrity(
  record: TravelRecord
): Promise<VerificationResult> {
  const txs = await getBlockchainTransactions();
  const recordTx = txs.find((t) => t.txHash === record.txHash);

  if (!recordTx) {
    return {
      isValid: false,
      computedHash: "",
      onChainHash: "",
      blockNumber: 0,
      txHash: "",
      timestamp: "",
      issuer: "",
      reason: "Transaction not found",
    };
  }

  const computedHash = hashData(record.details);
  const isValid = computedHash.toLowerCase() === recordTx.dataHash.toLowerCase();

  return {
    isValid,
    computedHash,
    onChainHash: recordTx.dataHash,
    blockNumber: recordTx.blockNumber,
    txHash: recordTx.txHash,
    timestamp: recordTx.timestamp,
    issuer: recordTx.issuer,
    reason: isValid ? "Valid record." : "Tampered record.",
  };
}

export async function anchorNewTravelRecord(params: {
  title: string;
  category: TravelRecord["category"];
  issuer: string;
  details: TravelRecord["details"];
  expiryDays?: number;
}): Promise<TravelRecord> {
  const profile = await getTouristProfile();
  const blocks = await getBlockchainBlocks();
  const txs = await getBlockchainTransactions();
  const records = await getTravelRecords();

  const nextBlockNum = (blocks[blocks.length - 1]?.blockNumber || 1044) + 1;
  const issueDate = new Date().toISOString().split("T")[0];
  const expiry = new Date(Date.now() + (params.expiryDays || 30) * 86400000)
    .toISOString()
    .split("T")[0];

  const dataHash = hashData(params.details);
  const txHash = sha256(`TX_REC_${Date.now()}_${Math.random()}`);

  const newTx: BlockchainTransaction = {
    txHash,
    blockNumber: nextBlockNum,
    timestamp: new Date().toISOString(),
    from: "0x89D24A6b4C1185449A0b938fFFf4c718a20cD810",
    type: "RECORD_ANCHOR",
    did: profile.did,
    dataHash,
    issuer: params.issuer,
    gasUsed: 31200,
    status: "CONFIRMED",
  };

  const prevBlock = blocks[blocks.length - 1];
  const newBlock: BlockchainBlock = {
    blockNumber: nextBlockNum,
    timestamp: newTx.timestamp,
    previousHash: prevBlock ? prevBlock.blockHash : sha256("PREV_BLOCK"),
    blockHash: sha256(`BLOCK_${nextBlockNum}_${txHash}`),
    merkleRoot: sha256(dataHash),
    validator: "0x89D24A6b4C1185449A0b938fFFf4c718a20cD810",
    transactions: [newTx],
  };

  const newRecord: TravelRecord = {
    id: `REC-${Date.now().toString().slice(-4)}`,
    title: params.title,
    category: params.category,
    issuer: params.issuer,
    issueDate,
    expiryDate: expiry,
    details: params.details,
    dataHash,
    txHash,
    blockNumber: nextBlockNum,
    status: "VALID",
  };

  const updatedRecords = [newRecord, ...records];
  const updatedBlocks = [...blocks, newBlock];
  const updatedTxs = [newTx, ...txs];

  await AsyncStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(updatedRecords));
  await AsyncStorage.setItem(STORAGE_KEYS.BLOCKS, JSON.stringify(updatedBlocks));
  await AsyncStorage.setItem(STORAGE_KEYS.TXS, JSON.stringify(updatedTxs));

  return newRecord;
}

export async function reAnchorIdentity(profile: TouristProfile): Promise<BlockchainTransaction> {
  const blocks = await getBlockchainBlocks();
  const txs = await getBlockchainTransactions();

  const nextBlockNum = (blocks[blocks.length - 1]?.blockNumber || 1041) + 1;
  const identityPayload = {
    id: profile.id,
    fullName: profile.fullName,
    nationality: profile.nationality,
    passportNumber: profile.passportNumber,
    dateOfBirth: profile.dateOfBirth,
    walletAddress: profile.walletAddress,
  };
  const dataHash = hashData(identityPayload);
  const txHash = sha256(`TX_REANCHOR_${profile.did}_${Date.now()}`);

  const newTx: BlockchainTransaction = {
    txHash,
    blockNumber: nextBlockNum,
    timestamp: new Date().toISOString(),
    from: profile.walletAddress,
    type: "IDENTITY_MINT",
    did: profile.did,
    dataHash,
    issuer: profile.issuer,
    gasUsed: 44000,
    status: "CONFIRMED",
  };

  const prevBlock = blocks[blocks.length - 1];
  const newBlock: BlockchainBlock = {
    blockNumber: nextBlockNum,
    timestamp: newTx.timestamp,
    previousHash: prevBlock ? prevBlock.blockHash : sha256("PREV_BLOCK"),
    blockHash: sha256(`BLOCK_${nextBlockNum}_${txHash}`),
    merkleRoot: sha256(dataHash),
    validator: "0x89D24A6b4C1185449A0b938fFFf4c718a20cD810",
    transactions: [newTx],
  };

  const updatedTxs = [newTx, ...txs];
  const updatedBlocks = [...blocks, newBlock];

  await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  await AsyncStorage.setItem(STORAGE_KEYS.BLOCKS, JSON.stringify(updatedBlocks));
  await AsyncStorage.setItem(STORAGE_KEYS.TXS, JSON.stringify(updatedTxs));

  return newTx;
}

export async function simulateTamperIdentity(): Promise<TouristProfile> {
  const profile = await getTouristProfile();
  const tampered: TouristProfile = {
    ...profile,
    passportNumber: profile.passportNumber.endsWith("X")
      ? profile.passportNumber.slice(0, -1) + "9"
      : profile.passportNumber + "X",
  };
  await saveTouristProfile(tampered);
  return tampered;
}

export interface NewTouristInput {
  fullName: string;
  nationality: string;
  passportNumber: string;
  dateOfBirth: string;
  bloodGroup: string;
  allergies: string;
  emergencyPhone: string;
  email?: string;
  authProvider?: "google" | "tourist_credentials";
}

export async function registerNewTouristIdentity(
  input: NewTouristInput
): Promise<TouristProfile> {
  const blocks = await getBlockchainBlocks();
  const txs = await getBlockchainTransactions();
  const records = await getTravelRecords();

  const nextBlockNum = (blocks[blocks.length - 1]?.blockNumber || 1041) + 1;
  const seedString = input.email || (input.fullName + Date.now().toString());
  const walletAddress = "0x" + sha256(seedString).slice(2, 42);
  const did = `did:tourist:${walletAddress}`;
  const touristId = `T-${Math.floor(100000 + Math.random() * 900000)}`;

  const profile: TouristProfile = {
    id: touristId,
    fullName: input.fullName.trim(),
    nationality: input.nationality.trim(),
    passportNumber: input.passportNumber.trim(),
    dateOfBirth: input.dateOfBirth.trim(),
    bloodGroup: input.bloodGroup.trim(),
    allergies: input.allergies.trim(),
    emergencyPhone: input.emergencyPhone.trim(),
    walletAddress,
    did,
    issuedAt: new Date().toISOString().split("T")[0],
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
    issuer: "National Tourism & Safety Protocol Authority",
    email: input.email,
  };

  const identityPayload = {
    id: profile.id,
    fullName: profile.fullName,
    nationality: profile.nationality,
    passportNumber: profile.passportNumber,
    dateOfBirth: profile.dateOfBirth,
    walletAddress: profile.walletAddress,
  };
  const identityDataHash = hashData(identityPayload);

  const emergencyPayload = {
    bloodGroup: profile.bloodGroup,
    allergies: profile.allergies,
    emergencyPhone: profile.emergencyPhone,
  };
  const emergencyHash = hashData(emergencyPayload);

  const idTx: BlockchainTransaction = {
    txHash: sha256(`TX_ID_${profile.did}_${Date.now()}`),
    blockNumber: nextBlockNum,
    timestamp: new Date().toISOString(),
    from: "0x89D24A6b4C1185449A0b938fFFf4c718a20cD810",
    type: "IDENTITY_MINT",
    did: profile.did,
    dataHash: identityDataHash,
    issuer: profile.issuer,
    gasUsed: 42100,
    status: "CONFIRMED",
  };

  const emergencyTx: BlockchainTransaction = {
    txHash: sha256(`TX_EMERGENCY_${profile.did}_${Date.now()}`),
    blockNumber: nextBlockNum,
    timestamp: new Date(Date.now() + 1000).toISOString(),
    from: profile.walletAddress,
    type: "EMERGENCY_DIRECTIVE",
    did: profile.did,
    dataHash: emergencyHash,
    issuer: "Tourist Self-Signed Anchor",
    gasUsed: 21500,
    status: "CONFIRMED",
  };

  const updatedRecords = records.filter(
    (r) =>
      !r.id.startsWith("REC-TREK") &&
      !r.id.startsWith("REC-HERITAGE") &&
      !r.id.startsWith("REC-INS")
  );

  const prevBlock = blocks[blocks.length - 1];
  const newBlock: BlockchainBlock = {
    blockNumber: nextBlockNum,
    timestamp: idTx.timestamp,
    previousHash: prevBlock ? prevBlock.blockHash : sha256("PREV_BLOCK"),
    blockHash: sha256(`BLOCK_${nextBlockNum}_${idTx.txHash}`),
    merkleRoot: sha256(identityDataHash + emergencyHash),
    validator: "0x89D24A6b4C1185449A0b938fFFf4c718a20cD810",
    transactions: [idTx, emergencyTx],
  };

  const updatedTxs = [idTx, emergencyTx, ...txs];
  const updatedBlocks = [...blocks, newBlock];

  await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  await AsyncStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(updatedRecords));
  await AsyncStorage.setItem(STORAGE_KEYS.BLOCKS, JSON.stringify(updatedBlocks));
  await AsyncStorage.setItem(STORAGE_KEYS.TXS, JSON.stringify(updatedTxs));

  return profile;
}

export async function resetBlockchainDemo(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.PROFILE);
  await AsyncStorage.removeItem(STORAGE_KEYS.RECORDS);
  await AsyncStorage.removeItem(STORAGE_KEYS.BLOCKS);
  await AsyncStorage.removeItem(STORAGE_KEYS.TXS);
  await initializeBlockchainState();
}
