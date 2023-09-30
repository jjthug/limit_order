const hre = require("hardhat");
// Process Env Variables
require('dotenv').config()
const { GELATO } = process.env;

async function main() {
  const Lock = await hre.ethers.getContractFactory("GelatoPineCore");
  const lock = await Lock.deploy();
  await lock.deployed();

  console.log(
      `Deployed to ${lock.address}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
