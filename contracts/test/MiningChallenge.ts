import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { MiningChallenge, MiningChallenge__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "MiningChallenge",
  )) as MiningChallenge__factory;

  // Keep consistent with deploy.ts: rewardToken = address(0), minMineInterval = 10 seconds
  const miningChallenge = (await factory.deploy(
    ethers.ZeroAddress,
    10n,
  )) as MiningChallenge;

  const miningChallengeAddress = await miningChallenge.getAddress();

  return { miningChallenge, miningChallengeAddress };
}

describe("MiningChallenge (FHE / ACL verification)", function () {
  let signers: Signers;
  let miningChallenge: MiningChallenge;
  let miningChallengeAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      charlie: ethSigners[3],
    };
  });

  beforeEach(async function () {
    // Run only in FHEVM mock environment (local Hardhat FHEVM node)
    if (!fhevm.isMock) {
      console.warn(
        `MiningChallenge tests can only run on a local FHEVM Hardhat node (mock mode)`,
      );
      this.skip();
    }

    ({ miningChallenge, miningChallengeAddress } = await deployFixture());
  });

  it("Alice can decrypt her total mined amount after first mining (ACL works)", async function () {
    const clearAmount = 10;

    // Encrypt constant 10 using hardhat-fhevm plugin in the local environment
    const encryptedAmount = await fhevm
      .createEncryptedInput(miningChallengeAddress, signers.alice.address)
      .add32(clearAmount)
      .encrypt();

    const tx = await miningChallenge
      .connect(signers.alice)
      .mine(encryptedAmount.handles[0], encryptedAmount.inputProof);
    await tx.wait();

    const playerEncryptedTotal = await miningChallenge.getPlayerTotalMined(
      signers.alice.address,
    );

    // Handle should not be ZeroHash, which means encrypted state is stored on-chain
    expect(playerEncryptedTotal).to.not.eq(ethers.ZeroHash);

    // Decrypt locally with hardhat-fhevm to verify allow/allowThis ACL configuration
    const clearTotal = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      playerEncryptedTotal,
      miningChallengeAddress,
      signers.alice,
    );

    expect(clearTotal).to.eq(clearAmount);
  });

  it("Second mining within minMineInterval reverts according to business logic (not ACL issue)", async function () {
    const clearAmount = 5;

    const encryptedAmount = await fhevm
      .createEncryptedInput(miningChallengeAddress, signers.alice.address)
      .add32(clearAmount)
      .encrypt();

    // First mining should succeed
    const tx1 = await miningChallenge
      .connect(signers.alice)
      .mine(encryptedAmount.handles[0], encryptedAmount.inputProof);
    await tx1.wait();

    // Second immediate mining should hit the require because interval < minMineInterval
    await expect(
      miningChallenge
        .connect(signers.alice)
        .mine(encryptedAmount.handles[0], encryptedAmount.inputProof),
    ).to.be.revertedWith("MiningChallenge: Too soon to mine again");
  });

  it("Alice and Bob can each mine and decrypt their own totals (multi-account ACL)", async function () {
    const aliceAmount = 7;
    const bobAmount = 3;

    // Alice mines 7
    const encAlice = await fhevm
      .createEncryptedInput(miningChallengeAddress, signers.alice.address)
      .add32(aliceAmount)
      .encrypt();

    const txAlice = await miningChallenge
      .connect(signers.alice)
      .mine(encAlice.handles[0], encAlice.inputProof);
    await txAlice.wait();

    // Bob mines 3
    const encBob = await fhevm
      .createEncryptedInput(miningChallengeAddress, signers.bob.address)
      .add32(bobAmount)
      .encrypt();

    const txBob = await miningChallenge
      .connect(signers.bob)
      .mine(encBob.handles[0], encBob.inputProof);
    await txBob.wait();

    const aliceEncryptedTotal = await miningChallenge.getPlayerTotalMined(
      signers.alice.address,
    );
    const bobEncryptedTotal = await miningChallenge.getPlayerTotalMined(
      signers.bob.address,
    );

    // Both handles should be non-ZeroHash
    expect(aliceEncryptedTotal).to.not.eq(ethers.ZeroHash);
    expect(bobEncryptedTotal).to.not.eq(ethers.ZeroHash);

    // From ACL perspective: Alice can only decrypt her own total, Bob can only decrypt his
    const aliceClearTotal = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      aliceEncryptedTotal,
      miningChallengeAddress,
      signers.alice,
    );
    const bobClearTotal = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      bobEncryptedTotal,
      miningChallengeAddress,
      signers.bob,
    );

    expect(aliceClearTotal).to.eq(aliceAmount);
    expect(bobClearTotal).to.eq(bobAmount);
  });

  it("After Alice and Bob mine, new player Charlie can still mine and decrypt", async function () {
    const aliceAmount = 5;
    const bobAmount = 8;
    const charlieAmount = 11;

    // Alice mines 5
    const encAlice = await fhevm
      .createEncryptedInput(miningChallengeAddress, signers.alice.address)
      .add32(aliceAmount)
      .encrypt();

    const txAlice = await miningChallenge
      .connect(signers.alice)
      .mine(encAlice.handles[0], encAlice.inputProof);
    await txAlice.wait();

    // Bob mines 8
    const encBob = await fhevm
      .createEncryptedInput(miningChallengeAddress, signers.bob.address)
      .add32(bobAmount)
      .encrypt();

    const txBob = await miningChallenge
      .connect(signers.bob)
      .mine(encBob.handles[0], encBob.inputProof);
    await txBob.wait();

    // New player Charlie mines 11, verifying that mining still works after the first two players
    const encCharlie = await fhevm
      .createEncryptedInput(miningChallengeAddress, signers.charlie.address)
      .add32(charlieAmount)
      .encrypt();

    const txCharlie = await miningChallenge
      .connect(signers.charlie)
      .mine(encCharlie.handles[0], encCharlie.inputProof);
    await txCharlie.wait();

    // Read encrypted total mined amounts for all three players
    const aliceEncryptedTotal = await miningChallenge.getPlayerTotalMined(
      signers.alice.address,
    );
    const bobEncryptedTotal = await miningChallenge.getPlayerTotalMined(
      signers.bob.address,
    );
    const charlieEncryptedTotal = await miningChallenge.getPlayerTotalMined(
      signers.charlie.address,
    );

    expect(aliceEncryptedTotal).to.not.eq(ethers.ZeroHash);
    expect(bobEncryptedTotal).to.not.eq(ethers.ZeroHash);
    expect(charlieEncryptedTotal).to.not.eq(ethers.ZeroHash);

    // Each player decrypts their own total mined amount
    const aliceClearTotal = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      aliceEncryptedTotal,
      miningChallengeAddress,
      signers.alice,
    );
    const bobClearTotal = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      bobEncryptedTotal,
      miningChallengeAddress,
      signers.bob,
    );
    const charlieClearTotal = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      charlieEncryptedTotal,
      miningChallengeAddress,
      signers.charlie,
    );

    expect(aliceClearTotal).to.eq(aliceAmount);
    expect(bobClearTotal).to.eq(bobAmount);
    expect(charlieClearTotal).to.eq(charlieAmount);

    // Verify the player count is 3 so all three players are recorded on-chain
    const playerCount = await miningChallenge.getPlayerCount();
    expect(playerCount).to.eq(3n);
  });
}
);


