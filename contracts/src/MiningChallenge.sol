// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Mining Challenge - Privacy-Preserving Mining DApp
/// @notice A DApp that allows players to mine resources with encrypted amounts.
/// The total mining amount, rankings, and rewards are computed on encrypted data.
contract MiningChallenge is ZamaEthereumConfig {
    // Player mining data structure
    struct PlayerData {
        euint32 totalMined;      // Encrypted total mined amount
        bool exists;              // Whether player has mined before
        uint256 lastMineTime;    // Last mining timestamp
    }

    // Mapping from player address to their encrypted mining data
    mapping(address => PlayerData) public players;

    // Array to store all player addresses for ranking
    address[] public playerAddresses;

    // Reward token address (optional, can be zero address)
    address public rewardToken;

    // Minimum time between mines (in seconds)
    uint256 public minMineInterval;

    // Total encrypted amount mined by all players
    euint32 public totalMinedAmount;

    // Events
    event PlayerMined(address indexed player, bytes32 encryptedAmount);
    event RewardDistributed(address indexed player, uint256 amount);

    /// @notice Constructor
    /// @param _rewardToken Address of the reward token contract (can be zero address)
    /// @param _minMineInterval Minimum time between mines in seconds
    constructor(address _rewardToken, uint256 _minMineInterval) {
        rewardToken = _rewardToken;
        minMineInterval = _minMineInterval;
        // Initialize totalMinedAmount to zero
        totalMinedAmount = FHE.asEuint32(0);
    }

    /// @notice Mine resources with encrypted amount
    /// @param encryptedAmount The encrypted amount of resources mined
    /// @param inputProof The input proof for the encrypted amount
    function mine(externalEuint32 encryptedAmount, bytes calldata inputProof) external {
        // Convert external encrypted input to internal encrypted type
        euint32 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // Ensure this contract has FHE compute permissions on the freshly verified input,
        // avoiding ACLNotAllowed() in multi-user scenarios.
        FHE.allowThis(amount);

        // Check minimum mine interval
        if (players[msg.sender].exists) {
            require(
                block.timestamp >= players[msg.sender].lastMineTime + minMineInterval,
                "MiningChallenge: Too soon to mine again"
            );
        }

        // Update player data
        if (!players[msg.sender].exists) {
            players[msg.sender].exists = true;
            players[msg.sender].totalMined = FHE.asEuint32(0);
            playerAddresses.push(msg.sender);
        }

        // Add to player's total (encrypted addition)
        players[msg.sender].totalMined = FHE.add(players[msg.sender].totalMined, amount);

        // Update global total (encrypted addition)
        totalMinedAmount = FHE.add(totalMinedAmount, amount);
        // Ensure the global total remains allowed for this contract in future FHE operations
        FHE.allowThis(totalMinedAmount);

        // Update last mine time
        players[msg.sender].lastMineTime = block.timestamp;

        // Grant ACL permissions for the player to decrypt their own total
        FHE.allowThis(players[msg.sender].totalMined);
        FHE.allow(players[msg.sender].totalMined, msg.sender);

        // Emit event (encrypted amount as bytes32 for event)
        emit PlayerMined(msg.sender, bytes32(uint256(0))); // Placeholder, actual encrypted data not directly emit-able
    }

    /// @notice Get player's encrypted total mined amount
    /// @param player Address of the player
    /// @return The encrypted total mined amount
    function getPlayerTotalMined(address player) external view returns (euint32) {
        require(players[player].exists, "MiningChallenge: Player does not exist");
        return players[player].totalMined;
    }

    /// @notice Get the encrypted total amount mined by all players
    /// @return The encrypted total amount
    function getTotalMinedAmount() external view returns (euint32) {
        return totalMinedAmount;
    }

    /// @notice Get the number of players
    /// @return The number of players who have mined
    function getPlayerCount() external view returns (uint256) {
        return playerAddresses.length;
    }

    /// @notice Get player address by index
    /// @param index The index in the playerAddresses array
    /// @return The player address at the given index
    function getPlayerAddress(uint256 index) external view returns (address) {
        require(index < playerAddresses.length, "MiningChallenge: Index out of bounds");
        return playerAddresses[index];
    }

    /// @notice Calculate the encrypted rank of the caller
    /// @return rankEnc The encrypted rank (number of players with higher scores + 1)
    /// @dev This function computes the rank by counting how many players have higher scores.
    /// All operations are performed in the encrypted domain:
    /// - Uses FHE.gt() to compare encrypted amounts
    /// - Uses FHE.select() to conditionally add 1 to the count
    /// - Returns encrypted rank that only the caller can decrypt
    function calculateMyRank() external returns (euint32 rankEnc) {
        require(players[msg.sender].exists, "MiningChallenge: Player does not exist");
        
        euint32 myAmount = players[msg.sender].totalMined;
        euint32 count = FHE.asEuint32(0); // Start with 0 (count of players with higher scores)
        
        // Iterate through all players and count how many have higher scores
        uint256 length = playerAddresses.length;
        for (uint256 i = 0; i < length; i++) {
            address otherPlayer = playerAddresses[i];
            if (otherPlayer != msg.sender) {
                euint32 otherAmount = players[otherPlayer].totalMined;
                // Compare: if otherAmount > myAmount, then add 1 to count
                ebool isGreater = FHE.gt(otherAmount, myAmount);
                // FHE.select(condition, valueIfTrue, valueIfFalse)
                // If isGreater is true, add 1, otherwise add 0
                euint32 increment = FHE.select(isGreater, FHE.asEuint32(1), FHE.asEuint32(0));
                count = FHE.add(count, increment);
            }
        }
        
        // Rank is count + 1 (if 0 players have higher scores, rank is 1)
        rankEnc = FHE.add(count, FHE.asEuint32(1));
        
        // Grant ACL permissions for the caller to decrypt their own rank
        FHE.allowThis(rankEnc);
        FHE.allow(rankEnc, msg.sender);
        
        return rankEnc;
    }

    /// @notice Distribute rewards based on ranking (simplified version)
    /// @param player Address of the player to reward
    /// @param amount Amount of reward tokens to distribute
    /// @dev This is a simplified reward function. In production, you would:
    /// 1. Compute rankings using encrypted comparisons
    /// 2. Distribute rewards based on encrypted rankings
    /// 3. Use a more sophisticated reward mechanism
    function distributeReward(address player, uint256 amount) external {
        require(players[player].exists, "MiningChallenge: Player does not exist");
        require(rewardToken != address(0), "MiningChallenge: Reward token not set");
        
        // In a real implementation, you would:
        // 1. Verify the player's ranking using encrypted comparisons
        // 2. Calculate reward based on encrypted ranking
        // 3. Transfer tokens
        
        // For now, this is a placeholder that can be extended
        emit RewardDistributed(player, amount);
    }

    /// @notice Check if a player exists
    /// @param player Address of the player
    /// @return Whether the player has mined before
    function playerExists(address player) external view returns (bool) {
        return players[player].exists;
    }

    /// @notice Get player's last mine time
    /// @param player Address of the player
    /// @return The timestamp of the last mine
    function getPlayerLastMineTime(address player) external view returns (uint256) {
        require(players[player].exists, "MiningChallenge: Player does not exist");
        return players[player].lastMineTime;
    }
}

