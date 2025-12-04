"use client";

import { useFhevm } from "@/fhevm/useFhevm";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { useMiningChallenge } from "@/hooks/useMiningChallenge";
import { useState } from "react";

type TabType = "mining" | "ranking" | "info";

export const MiningChallengeDemo = () => {
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const {
    provider,
    chainId,
    accounts,
    isConnected,
    connect,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    initialMockChains,
  } = useMetaMaskEthersSigner();

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const miningChallenge = useMiningChallenge({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
    eip1193Provider: provider,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  });

  const [miningAmount, setMiningAmount] = useState<string>("10");
  const [activeTab, setActiveTab] = useState<TabType>("mining");

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-white mb-4">
              Mining Challenge
            </h1>
            <p className="text-xl text-slate-300">
              Privacy-Preserving Resource Mining
            </p>
          </div>
          <button
            className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
            onClick={connect}
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (miningChallenge.isDeployed === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="max-w-md mx-auto p-8 bg-red-900 text-red-100 rounded-lg border-2 border-red-700">
          <h2 className="text-2xl font-bold mb-4">Contract Not Deployed</h2>
          <p>
            The Mining Challenge contract is not deployed on this network. Please switch to a supported network or deploy the contract first.
          </p>
        </div>
      </div>
    );
  }

  const TabButton = ({ tab, label }: { tab: TabType; label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-6 py-3 font-semibold text-lg transition-all ${
        activeTab === tab
          ? "bg-blue-600 text-white"
          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b-2 border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">
                Mining Challenge
              </h1>
              <p className="text-slate-400 mt-1">
                Encrypted Mining Dashboard
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Connected Account</div>
              <div className="text-sm font-mono bg-slate-700 px-3 py-1 rounded mt-1">
                {ethersSigner?.address
                  ? `${ethersSigner.address.slice(0, 6)}...${ethersSigner.address.slice(-4)}`
                  : "Not connected"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-slate-800 border-b-2 border-slate-700">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2">
            <TabButton tab="mining" label="Mining" />
            <TabButton tab="ranking" label="Ranking" />
            <TabButton tab="info" label="System Info" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Status Message */}
        {miningChallenge.message && (
          <div className="mb-6 p-4 bg-slate-800 border-l-4 border-blue-500 rounded-r-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-blue-400 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-slate-200">
                  {miningChallenge.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mining Tab */}
        {activeTab === "mining" && (
          <div className="space-y-6">
            {/* Mining Stats */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-6 text-white">
                Your Mining Stats
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-700 rounded-lg p-5">
                  <div className="text-sm text-slate-400 mb-2">
                    Encrypted Handle
                  </div>
                  <div className="text-lg font-mono text-white break-all">
                    {miningChallenge.handle
                      ? `${miningChallenge.handle.slice(0, 10)}...${miningChallenge.handle.slice(-8)}`
                      : "No data yet"}
                  </div>
                </div>
                <div className="bg-slate-700 rounded-lg p-5">
                  <div className="text-sm text-slate-400 mb-2">
                    Total Mined
                  </div>
                  <div className="text-3xl font-bold text-blue-400">
                    {miningChallenge.isDecrypted
                      ? `${miningChallenge.clear?.toString() || "0"} resources`
                      : "Encrypted"}
                  </div>
                </div>
              </div>
            </div>

            {/* Mining Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mine Resources Card */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-white">
                  Mine Resources
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Amount to Mine
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={miningAmount}
                      onChange={(e) => setMiningAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                      placeholder="Enter amount"
                    />
                  </div>
                  <button
                    disabled={!miningChallenge.canMine}
                    onClick={() => {
                      const amount = parseInt(miningAmount);
                      if (amount > 0) {
                        miningChallenge.mine(amount);
                      }
                    }}
                    className={`w-full px-6 py-3 rounded-lg font-semibold text-lg transition-colors ${
                      miningChallenge.canMine
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-slate-700 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    {miningChallenge.isMining
                      ? "Mining..."
                      : miningChallenge.canMine
                      ? `Mine ${miningAmount} Resources`
                      : "Cannot Mine"}
                  </button>
                </div>
              </div>

              {/* Decrypt Card */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-white">
                  View Your Total
                </h3>
                <div className="space-y-4">
                  <div className="bg-slate-700 rounded-lg p-4">
                    <div className="text-sm text-slate-400 mb-2">
                      Decryption Status
                    </div>
                    <div className="text-lg text-white">
                      {miningChallenge.isDecrypted
                        ? "✓ Decrypted"
                        : "Encrypted"}
                    </div>
                  </div>
                  <button
                    disabled={!miningChallenge.canDecrypt}
                    onClick={miningChallenge.decryptPlayerTotal}
                    className={`w-full px-6 py-3 rounded-lg font-semibold text-lg transition-colors ${
                      miningChallenge.canDecrypt
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-slate-700 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    {miningChallenge.isDecrypting
                      ? "Decrypting..."
                      : miningChallenge.isDecrypted
                      ? `Total: ${miningChallenge.clear?.toString()} Resources`
                      : "Decrypt Total"}
                  </button>
                  <button
                    disabled={!miningChallenge.canMine}
                    onClick={miningChallenge.refreshPlayerTotal}
                    className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
                      miningChallenge.canMine
                        ? "bg-slate-700 hover:bg-slate-600 text-white"
                        : "bg-slate-700 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    {miningChallenge.isRefreshing
                      ? "Refreshing..."
                      : "Refresh Data"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ranking Tab */}
        {activeTab === "ranking" && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-6 text-white">
                Your Ranking
              </h2>

              {miningChallenge.playerRank !== undefined && (
                <div className="mb-6 p-6 bg-blue-900 border-2 border-blue-700 rounded-lg">
                  <div className="text-center">
                    <div className="text-6xl font-bold text-blue-300 mb-2">
                      #{miningChallenge.playerRank.toString()}
                    </div>
                    <div className="text-xl text-blue-200">Your Rank</div>
                    {miningChallenge.playerCount !== undefined && (
                      <div className="text-sm text-blue-300 mt-2">
                        out of {miningChallenge.playerCount} players
                      </div>
                    )}
                  </div>
                </div>
              )}

              {miningChallenge.playerRank === undefined &&
                miningChallenge.playerRankEncrypted &&
                !miningChallenge.isCalculatingRank && (
                  <div className="mb-6 p-4 bg-yellow-900 border border-yellow-700 rounded-lg">
                    <p className="text-yellow-200">
                      Your rank has been calculated. Click "Decrypt Rank" to reveal your position.
                    </p>
                  </div>
                )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  disabled={!miningChallenge.canCalculateRank}
                  onClick={miningChallenge.calculateMyRank}
                  className={`px-6 py-4 rounded-lg font-semibold text-lg transition-colors ${
                    miningChallenge.canCalculateRank
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-slate-700 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  {miningChallenge.isCalculatingRank
                    ? "Calculating..."
                    : "Calculate My Rank"}
                </button>
                <button
                  disabled={!miningChallenge.canDecryptRank}
                  onClick={miningChallenge.decryptMyRank}
                  className={`px-6 py-4 rounded-lg font-semibold text-lg transition-colors ${
                    miningChallenge.canDecryptRank
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-slate-700 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  {miningChallenge.isDecryptingRank
                    ? "Decrypting..."
                    : miningChallenge.playerRank !== undefined
                    ? `Rank: #${miningChallenge.playerRank.toString()}`
                    : "Decrypt Rank"}
                </button>
              </div>

              {miningChallenge.playerCount !== undefined && (
                <div className="mt-6 p-4 bg-slate-700 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Total Players:</span>
                    <span className="text-2xl font-bold text-white">
                      {miningChallenge.playerCount}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-3 text-white">
                About Rankings
              </h3>
              <div className="text-slate-300 space-y-2 text-sm">
                <p>
                  • Rankings are calculated based on your total mined resources
                </p>
                <p>
                  • Click "Calculate My Rank" to compute your current position
                </p>
                <p>
                  • After calculation, decrypt to reveal your rank number
                </p>
                <p>
                  • All ranking data is encrypted for privacy
                </p>
              </div>
            </div>
          </div>
        )}

        {/* System Info Tab */}
        {activeTab === "info" && (
          <div className="space-y-6">
            {/* Network Info */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-4 text-white">
                Network Information
              </h2>
              <div className="space-y-3">
                <InfoRow label="Chain ID" value={chainId?.toString() || "Unknown"} />
                <InfoRow
                  label="Contract Address"
                  value={
                    miningChallenge.contractAddress
                      ? `${miningChallenge.contractAddress.slice(0, 10)}...${miningChallenge.contractAddress.slice(-8)}`
                      : "Not deployed"
                  }
                />
                <InfoRow
                  label="Contract Status"
                  value={miningChallenge.isDeployed ? "Deployed" : "Not deployed"}
                  valueColor={miningChallenge.isDeployed ? "text-green-400" : "text-red-400"}
                />
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-4 text-white">
                Account Information
              </h2>
              <div className="space-y-3">
                <InfoRow
                  label="Wallet Address"
                  value={
                    ethersSigner?.address
                      ? `${ethersSigner.address.slice(0, 10)}...${ethersSigner.address.slice(-8)}`
                      : "Not connected"
                  }
                />
                <InfoRow
                  label="Connected Accounts"
                  value={accounts?.length ? `${accounts.length} account(s)` : "No accounts"}
                />
              </div>
            </div>

            {/* FHEVM Status */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-4 text-white">
                FHEVM Status
              </h2>
              <div className="space-y-3">
                <InfoRow
                  label="Instance Status"
                  value={fhevmInstance ? "Initialized" : "Not initialized"}
                  valueColor={fhevmInstance ? "text-green-400" : "text-yellow-400"}
                />
                <InfoRow label="Connection Status" value={fhevmStatus} />
                {fhevmError && (
                  <InfoRow
                    label="Error"
                    value={fhevmError}
                    valueColor="text-red-400"
                  />
                )}
              </div>
            </div>

            {/* Operation Status */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-4 text-white">
                Operation Status
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatusBadge
                  label="Can Mine"
                  active={miningChallenge.canMine}
                />
                <StatusBadge
                  label="Can Decrypt"
                  active={miningChallenge.canDecrypt}
                />
                <StatusBadge
                  label="Mining"
                  active={miningChallenge.isMining}
                />
                <StatusBadge
                  label="Decrypting"
                  active={miningChallenge.isDecrypting}
                />
                <StatusBadge
                  label="Refreshing"
                  active={miningChallenge.isRefreshing}
                />
                <StatusBadge
                  label="Calculating Rank"
                  active={miningChallenge.isCalculatingRank}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper Components
const InfoRow = ({
  label,
  value,
  valueColor = "text-white",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-700 last:border-b-0">
    <span className="text-slate-400">{label}:</span>
    <span className={`font-mono font-semibold ${valueColor}`}>{value}</span>
  </div>
);

const StatusBadge = ({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) => (
  <div
    className={`px-4 py-2 rounded-lg text-center ${
      active
        ? "bg-green-900 border border-green-700 text-green-300"
        : "bg-slate-700 border border-slate-600 text-slate-400"
    }`}
  >
    <div className="text-sm font-medium">{label}</div>
    <div className="text-xs mt-1">{active ? "Active" : "Inactive"}</div>
  </div>
);
