"use client";

import { ethers } from "ethers";
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";

import { MiningChallengeAddresses } from "@/abi/MiningChallengeAddresses";
import { MiningChallengeABI } from "@/abi/MiningChallengeABI";

export type ClearValueType = {
  handle: string;
  clear: string | bigint | boolean;
};

type MiningChallengeInfoType = {
  abi: typeof MiningChallengeABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

// Removed PlayerRanking type - no longer using global rankings

/**
 * Resolves MiningChallenge contract metadata for the given EVM chainId.
 */
function getMiningChallengeByChainId(
  chainId: number | undefined
): MiningChallengeInfoType {
  if (!chainId) {
    return { abi: MiningChallengeABI.abi };
  }

  const entry =
    MiningChallengeAddresses[chainId.toString() as keyof typeof MiningChallengeAddresses];

  if (!entry || !("address" in entry) || entry.address === ethers.ZeroAddress) {
    return { abi: MiningChallengeABI.abi, chainId };
  }

  return {
    address: entry.address as `0x${string}` | undefined,
    chainId: entry.chainId ?? chainId,
    chainName: entry.chainName,
    abi: MiningChallengeABI.abi,
  };
}

/**
 * Main MiningChallenge React hook with mining, decryption, and ranking functionality.
 */
export const useMiningChallenge = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  eip1193Provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<
    (ethersSigner: ethers.JsonRpcSigner | undefined) => boolean
  >;
}) => {
  const {
    instance,
    fhevmDecryptionSignatureStorage,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  } = parameters;

  // States
  const [playerTotalMined, setPlayerTotalMined] = useState<string | undefined>(undefined);
  const [clearPlayerTotal, setClearPlayerTotal] = useState<ClearValueType | undefined>(undefined);
  const [totalMinedAmount, setTotalMinedAmount] = useState<string | undefined>(undefined);
  const [playerCount, setPlayerCount] = useState<number | undefined>(undefined);
  const [playerRankEncrypted, setPlayerRankEncrypted] = useState<string | undefined>(undefined);
  const [playerRankDecrypted, setPlayerRankDecrypted] = useState<bigint | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isMining, setIsMining] = useState<boolean>(false);
  const [isCalculatingRank, setIsCalculatingRank] = useState<boolean>(false);
  const [isDecryptingRank, setIsDecryptingRank] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  // Refs
  const miningChallengeRef = useRef<MiningChallengeInfoType | undefined>(undefined);
  const isRefreshingRef = useRef<boolean>(isRefreshing);
  const isDecryptingRef = useRef<boolean>(isDecrypting);
  const isMiningRef = useRef<boolean>(isMining);
  const clearPlayerTotalRef = useRef<ClearValueType>(undefined);

  const isDecrypted = playerTotalMined && playerTotalMined === clearPlayerTotal?.handle;

  // MiningChallenge contract info
  const miningChallenge = useMemo(() => {
    const c = getMiningChallengeByChainId(chainId);
    miningChallengeRef.current = c;

    if (!c.address) {
      setMessage(`Contract not deployed on this network.`);
    }

    return c;
  }, [chainId]);

  // Refresh player's total mined amount
  const refreshPlayerTotal = useCallback(() => {
    if (isRefreshingRef.current) {
      return;
    }

    if (
      !miningChallengeRef.current ||
      !miningChallengeRef.current?.chainId ||
      !miningChallengeRef.current?.address ||
      !ethersReadonlyProvider ||
      !ethersSigner
    ) {
      setPlayerTotalMined(undefined);
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    const thisChainId = miningChallengeRef.current.chainId;
    const thisContractAddress = miningChallengeRef.current.address;
    const thisEthersSigner = ethersSigner;

    const thisContract = new ethers.Contract(
      thisContractAddress,
      miningChallengeRef.current.abi,
      ethersReadonlyProvider
    );

    // First check if player exists
    thisContract
      .playerExists(thisEthersSigner.address)
      .then((exists: boolean) => {
        if (!exists) {
          // Player doesn't exist yet - this is normal for new users
          if (
            sameChain.current(thisChainId) &&
            thisContractAddress === miningChallengeRef.current?.address
          ) {
            setPlayerTotalMined(undefined);
            setMessage(""); // Clear any previous error messages
          }
          isRefreshingRef.current = false;
          setIsRefreshing(false);
          return;
        }

        // Player exists, get their total mined amount
        return thisContract.getPlayerTotalMined(thisEthersSigner.address);
      })
      .then((value: string | undefined) => {
        if (value !== undefined) {
          if (
            sameChain.current(thisChainId) &&
            thisContractAddress === miningChallengeRef.current?.address
          ) {
            setPlayerTotalMined(value);
            setMessage(""); // Clear any previous error messages
          }
        }

        isRefreshingRef.current = false;
        setIsRefreshing(false);
      })
      .catch((e: Error) => {
        // Check if error is about player not existing
        const errorMessage = e.toString();
        if (errorMessage.includes("Player does not exist")) {
          // Player doesn't exist - this is normal for new users
          if (
            sameChain.current(thisChainId) &&
            thisContractAddress === miningChallengeRef.current?.address
          ) {
            setPlayerTotalMined(undefined);
            setMessage(""); // Clear error message - this is expected for new users
          }
        } else {
          // Other errors - show friendly message
          setMessage("Failed to fetch mining data. Please try again later. If the problem persists, please check your network connection.");
        }
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      });
  }, [ethersReadonlyProvider, ethersSigner, sameChain]);

  // Auto refresh player total
  useEffect(() => {
    refreshPlayerTotal();
  }, [refreshPlayerTotal]);

  // Decrypt player's total mined amount
  const decryptPlayerTotal = useCallback(() => {
    if (isRefreshingRef.current || isDecryptingRef.current) {
      return;
    }

    if (!miningChallenge.address || !instance || !ethersSigner) {
      return;
    }

    if (playerTotalMined === clearPlayerTotalRef.current?.handle) {
      return;
    }

    if (!playerTotalMined) {
      setClearPlayerTotal(undefined);
      clearPlayerTotalRef.current = undefined;
      return;
    }

    if (playerTotalMined === ethers.ZeroHash) {
      setClearPlayerTotal({ handle: playerTotalMined, clear: BigInt(0) });
      clearPlayerTotalRef.current = { handle: playerTotalMined, clear: BigInt(0) };
      return;
    }

    const thisChainId = chainId;
    const thisContractAddress = miningChallenge.address;
    const thisPlayerTotalHandle = playerTotalMined;
    const thisEthersSigner = ethersSigner;

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    setMessage("Starting decryption process...");

    const run = async () => {
      const isStale = () =>
        thisContractAddress !== miningChallengeRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        const sig: FhevmDecryptionSignature | null =
          await FhevmDecryptionSignature.loadOrSign(
            instance,
            [miningChallenge.address as `0x${string}`],
            ethersSigner,
            fhevmDecryptionSignatureStorage
          );

        if (!sig) {
          setMessage("Unable to build decryption signature. Please try again.");
          return;
        }

        if (isStale()) {
          setMessage("Decryption cancelled due to network change.");
          return;
        }

        setMessage("Processing decryption...");

        const res = await instance.userDecrypt(
          [{ handle: thisPlayerTotalHandle, contractAddress: thisContractAddress }],
          sig.privateKey,
          sig.publicKey,
          sig.signature,
          sig.contractAddresses,
          sig.userAddress,
          sig.startTimestamp,
          sig.durationDays
        );

        setMessage("Decryption completed successfully!");

        if (isStale()) {
          setMessage("Decryption cancelled due to network change.");
          return;
        }

        setClearPlayerTotal({ handle: thisPlayerTotalHandle, clear: res[thisPlayerTotalHandle as `0x${string}`] });
        clearPlayerTotalRef.current = {
          handle: thisPlayerTotalHandle,
          clear: res[thisPlayerTotalHandle as `0x${string}`],
        };

        setMessage(
          "Your total mined: " + clearPlayerTotalRef.current.clear + " resources"
        );
      } catch (error) {
        console.error("Decryption failed:", error);
        setMessage("Decryption failed. Please try again.");
      } finally {
        isDecryptingRef.current = false;
        setIsDecrypting(false);
      }
    };

    run();
  }, [
    fhevmDecryptionSignatureStorage,
    ethersSigner,
    miningChallenge.address,
    instance,
    playerTotalMined,
    chainId,
    sameChain,
    sameSigner,
  ]);

  // Mine resources
  const mine = useCallback(
    (amount: number) => {
      if (isRefreshingRef.current || isMiningRef.current) {
        return;
      }

      if (!miningChallenge.address || !instance || !ethersSigner || amount <= 0) {
        return;
      }

      const thisChainId = chainId;
      const thisContractAddress = miningChallenge.address;
      const thisEthersSigner = ethersSigner;
      const thisContract = new ethers.Contract(
        thisContractAddress,
        miningChallenge.abi,
        thisEthersSigner
      );

      isMiningRef.current = true;
      setIsMining(true);
      setMessage(`Start mining ${amount} resources...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisContractAddress !== miningChallengeRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          const input = instance.createEncryptedInput(
            thisContractAddress,
            thisEthersSigner.address
          );
          input.add32(amount);

          const enc = await input.encrypt();

          if (isStale()) {
            setMessage("Mining cancelled due to network change.");
            return;
          }

          setMessage(`Mining ${amount} resources...`);

          const tx: ethers.TransactionResponse = await thisContract.mine(
            enc.handles[0],
            enc.inputProof
          );

          setMessage(`Transaction submitted. Waiting for confirmation...`);

          const receipt = await tx.wait();

          if (receipt?.status === 1) {
            setMessage(`Successfully mined ${amount} resources!`);
          } else {
            setMessage(`Mining transaction failed. Please try again.`);
          }

          if (isStale()) {
            setMessage("Mining cancelled due to network change.");
            return;
          }

          refreshPlayerTotal();
        } catch (error) {
          setMessage(`Mining failed. Please try again.`);
        } finally {
          isMiningRef.current = false;
          setIsMining(false);
        }
      };

      run();
    },
    [
      ethersSigner,
      miningChallenge.address,
      miningChallenge.abi,
      instance,
      chainId,
      refreshPlayerTotal,
      sameChain,
      sameSigner,
    ]
  );

  // Calculate player's own rank
  const calculateMyRank = useCallback(() => {
    if (!miningChallenge.address || !ethersSigner) {
      return;
    }

    setIsCalculatingRank(true);
    setMessage("Calculating your rank...");

    const thisChainId = chainId;
    const thisContractAddress = miningChallenge.address;
    const thisEthersSigner = ethersSigner;

    const thisContract = new ethers.Contract(
      miningChallenge.address,
      miningChallenge.abi,
      ethersSigner
    );

    const run = async () => {
      const isStale = () =>
        thisContractAddress !== miningChallengeRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        // calculateMyRank is a state-changing function, so we need to send a transaction
        setMessage("Submitting rank calculation request...");
        
        const tx: ethers.TransactionResponse = await thisContract.calculateMyRank();
        
        setMessage(`Transaction submitted. Waiting for confirmation...`);
        
        const receipt = await tx.wait();
        
        if (isStale()) {
          setMessage("Rank calculation cancelled due to network change.");
          return;
        }

        setMessage("Retrieving your rank...");

        // After transaction is confirmed, call the function again with staticCall to get the return value
        const rankEnc = await thisContract.calculateMyRank.staticCall();
        
        if (isStale()) {
          setMessage("Rank calculation cancelled due to network change.");
          return;
        }

        // Convert rankEnc to string format (euint32 is returned as bytes32)
        // ethers.js should already return it as a hex string, but ensure it's the right format
        let rankHandle: string;
        if (typeof rankEnc === "string") {
          // Ensure it's a valid hex string with 0x prefix
          rankHandle = rankEnc.startsWith("0x") ? rankEnc : `0x${rankEnc}`;
        } else if (rankEnc instanceof Uint8Array) {
          rankHandle = ethers.hexlify(rankEnc);
        } else {
          // Try to convert to hex string
          rankHandle = ethers.hexlify(rankEnc);
        }
        
        // Ensure it's exactly 66 characters (0x + 64 hex chars for bytes32)
        if (rankHandle.length !== 66) {
          // Pad or truncate to 66 characters
          const hexPart = rankHandle.slice(2).padStart(64, "0").slice(0, 64);
          rankHandle = `0x${hexPart}`;
        }
        
        setPlayerRankEncrypted(rankHandle);
        // Clear previous decrypted rank so decrypt button becomes available
        setPlayerRankDecrypted(undefined);
        setMessage("Rank calculated successfully! Click decrypt to view your ranking.");
      } catch (error) {
        console.error("Rank calculation failed:", error);
        setMessage("Failed to calculate rank. Please try again.");
      } finally {
        setIsCalculatingRank(false);
      }
    };

    run();
  }, [miningChallenge.address, miningChallenge.abi, ethersSigner, chainId, sameChain, sameSigner]);

  // Decrypt player's rank
  const decryptMyRank = useCallback(() => {
    if (!miningChallenge.address || !instance || !ethersSigner || !playerRankEncrypted) {
      return;
    }

    setIsDecryptingRank(true);
    setMessage("Decrypting your rank...");

    const thisChainId = chainId;
    const thisContractAddress = miningChallenge.address;
    const thisRankHandle = playerRankEncrypted;
    const thisEthersSigner = ethersSigner;

    const run = async () => {
      const isStale = () =>
        thisContractAddress !== miningChallengeRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        const sig: FhevmDecryptionSignature | null =
          await FhevmDecryptionSignature.loadOrSign(
            instance,
            [miningChallenge.address as `0x${string}`],
            ethersSigner,
            fhevmDecryptionSignatureStorage
          );

        if (!sig) {
          setMessage("Unable to build decryption signature. Please try again.");
          return;
        }

        if (isStale()) {
          setMessage("Rank decryption cancelled due to network change.");
          return;
        }

        setMessage("Processing rank decryption...");

        // Ensure handle is in the correct format (string or Uint8Array)
        // thisRankHandle should already be a string from calculateMyRank
        const handleForDecrypt: string | Uint8Array = thisRankHandle;

        const res = await instance.userDecrypt(
          [{ handle: handleForDecrypt, contractAddress: thisContractAddress }],
          sig.privateKey,
          sig.publicKey,
          sig.signature,
          sig.contractAddresses,
          sig.userAddress,
          sig.startTimestamp,
          sig.durationDays
        );

        setMessage("Rank decryption completed!");

        if (isStale()) {
          setMessage("Rank decryption cancelled due to network change.");
          return;
        }

        const rankValue = res[handleForDecrypt as `0x${string}`];
        if (rankValue !== undefined && rankValue !== null) {
          if (typeof rankValue === "bigint") {
            setPlayerRankDecrypted(rankValue);
            setMessage(`Your rank: #${rankValue.toString()}`);
          } else if (typeof rankValue === "number") {
            const rankBigInt = BigInt(rankValue);
            setPlayerRankDecrypted(rankBigInt);
            setMessage(`Your rank: #${rankBigInt.toString()}`);
          } else {
            setMessage("Unable to retrieve rank value. Please try again.");
          }
        } else {
          setMessage("Unable to retrieve rank value. Please try again.");
        }
      } catch (error) {
        console.error("Rank decryption failed:", error);
        setMessage("Rank decryption failed. Please try again.");
      } finally {
        setIsDecryptingRank(false);
      }
    };

    run();
  }, [
    fhevmDecryptionSignatureStorage,
    ethersSigner,
    miningChallenge.address,
    instance,
    playerRankEncrypted,
    chainId,
    sameChain,
    sameSigner,
  ]);

  // Computed values
  const canMine = useMemo(() => {
    return (
      miningChallenge.address &&
      instance &&
      ethersSigner &&
      !isRefreshing &&
      !isMining
    );
  }, [miningChallenge.address, instance, ethersSigner, isRefreshing, isMining]);

  const canDecrypt = useMemo(() => {
    return (
      miningChallenge.address &&
      instance &&
      ethersSigner &&
      !isRefreshing &&
      !isDecrypting &&
      playerTotalMined &&
      playerTotalMined !== ethers.ZeroHash &&
      playerTotalMined !== clearPlayerTotal?.handle
    );
  }, [
    miningChallenge.address,
    instance,
    ethersSigner,
    isRefreshing,
    isDecrypting,
    playerTotalMined,
    clearPlayerTotal,
  ]);

  const canCalculateRank = useMemo(() => {
    return (
      miningChallenge.address &&
      ethersSigner &&
      !isCalculatingRank
    );
  }, [miningChallenge.address, ethersSigner, isCalculatingRank]);

  const canDecryptRank = useMemo(() => {
    return (
      miningChallenge.address &&
      instance &&
      ethersSigner &&
      !isDecryptingRank &&
      playerRankEncrypted &&
      playerRankEncrypted !== ethers.ZeroHash &&
      playerRankDecrypted === undefined
    );
  }, [
    miningChallenge.address,
    instance,
    ethersSigner,
    isDecryptingRank,
    playerRankEncrypted,
    playerRankDecrypted,
  ]);

  return {
    contractAddress: miningChallenge.address,
    canMine,
    canDecrypt,
    mine,
    decryptPlayerTotal,
    refreshPlayerTotal,
    calculateMyRank,
    decryptMyRank,
    canCalculateRank,
    canDecryptRank,
    isDecrypted,
    message,
    clear: clearPlayerTotal?.clear,
    handle: playerTotalMined,
    isDecrypting,
    isRefreshing,
    isMining,
    isCalculatingRank,
    isDecryptingRank,
    playerCount,
    playerRank: playerRankDecrypted,
    playerRankEncrypted,
    isDeployed: Boolean(miningChallenge.address && miningChallenge.address !== ethers.ZeroAddress),
  };
};

