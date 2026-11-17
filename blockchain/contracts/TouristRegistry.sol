// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TouristRegistry
/// @notice Anchors SHA-256 fingerprints of tourist identity records and travel
///         records. It stores NO personal data: only an ID like
///         "TOURIST-2026-001", 32-byte hashes and timestamps.
///
/// Trust model: only the `issuer` (the app's backend wallet) can write.
/// Anyone can read, so anyone can check a record's fingerprint independently.
contract TouristRegistry {
    enum Status { None, Active, Revoked }

    struct Identity {
        bytes32 hash;      // fingerprint of the identity record
        uint64 timestamp;  // when it was anchored
        Status status;
    }

    struct Anchor {
        bytes32 hash;      // fingerprint of a travel / consent / emergency record
        uint64 timestamp;
    }

    address public issuer;

    mapping(string => Identity) private identities;
    // touristId => recordId => anchor
    mapping(string => mapping(bytes32 => Anchor)) private anchors;
    mapping(string => uint256) private anchorCounts;

    event IdentityRegistered(string touristId, bytes32 hash, uint64 timestamp);
    event IdentityRevoked(string touristId, uint64 timestamp);
    event RecordAnchored(string touristId, bytes32 recordId, bytes32 hash, uint64 timestamp);
    event IssuerTransferred(address indexed previousIssuer, address indexed newIssuer);

    error NotIssuer();
    error AlreadyRegistered();
    error UnknownIdentity();
    error IdentityNotActive();
    error AlreadyAnchored();
    error EmptyHash();
    error EmptyId();
    error ZeroAddress();

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert NotIssuer();
        _;
    }

    constructor() {
        issuer = msg.sender;
    }

    function transferIssuer(address newIssuer) external onlyIssuer {
        if (newIssuer == address(0)) revert ZeroAddress();
        emit IssuerTransferred(issuer, newIssuer);
        issuer = newIssuer;
    }

    /// @notice Anchor a new tourist identity. Each ID can be registered once.
    function registerIdentity(string calldata touristId, bytes32 hash) external onlyIssuer {
        if (bytes(touristId).length == 0) revert EmptyId();
        if (hash == bytes32(0)) revert EmptyHash();
        if (identities[touristId].status != Status.None) revert AlreadyRegistered();

        uint64 ts = uint64(block.timestamp);
        identities[touristId] = Identity(hash, ts, Status.Active);
        emit IdentityRegistered(touristId, hash, ts);
    }

    /// @notice Mark an identity as no longer valid. The hash stays on record.
    function revokeIdentity(string calldata touristId) external onlyIssuer {
        Identity storage id = identities[touristId];
        if (id.status == Status.None) revert UnknownIdentity();
        if (id.status == Status.Revoked) revert IdentityNotActive();
        id.status = Status.Revoked;
        emit IdentityRevoked(touristId, uint64(block.timestamp));
    }

    /// @notice Anchor a travel record, an emergency-info update, or a consent
    ///         change for an active identity. A recordId can be anchored once,
    ///         so an anchored fingerprint can never be silently replaced.
    function anchorRecord(string calldata touristId, bytes32 recordId, bytes32 hash) external onlyIssuer {
        if (hash == bytes32(0)) revert EmptyHash();
        Identity storage id = identities[touristId];
        if (id.status == Status.None) revert UnknownIdentity();
        if (id.status != Status.Active) revert IdentityNotActive();
        if (anchors[touristId][recordId].timestamp != 0) revert AlreadyAnchored();

        uint64 ts = uint64(block.timestamp);
        anchors[touristId][recordId] = Anchor(hash, ts);
        anchorCounts[touristId] += 1;
        emit RecordAnchored(touristId, recordId, hash, ts);
    }

    function getIdentity(string calldata touristId)
        external
        view
        returns (bool exists, bytes32 hash, uint64 timestamp, Status status)
    {
        Identity storage id = identities[touristId];
        return (id.status != Status.None, id.hash, id.timestamp, id.status);
    }

    function getRecord(string calldata touristId, bytes32 recordId)
        external
        view
        returns (bool exists, bytes32 hash, uint64 timestamp)
    {
        Anchor storage a = anchors[touristId][recordId];
        return (a.timestamp != 0, a.hash, a.timestamp);
    }

    function recordCount(string calldata touristId) external view returns (uint256) {
        return anchorCounts[touristId];
    }
}
