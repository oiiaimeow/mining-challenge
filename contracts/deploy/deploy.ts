import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Deploy MiningChallenge contract
  // rewardToken: address(0) means no reward token (optional)
  // minMineInterval: 60 seconds (1 minute)
  const deployedMiningChallenge = await deploy("MiningChallenge", {
    from: deployer,
    args: [hre.ethers.ZeroAddress, 10], // rewardToken, minMineInterval
    log: true,
    waitConfirmations: 1,
  });

  console.log(`MiningChallenge contract deployed at: ${deployedMiningChallenge.address}`);
};
export default func;
func.id = "deploy_miningChallenge"; // id required to prevent reexecution
func.tags = ["MiningChallenge"];

