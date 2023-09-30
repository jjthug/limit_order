const hre = require("hardhat");
// Process Env Variables
require('dotenv').config()
const { GELATO_OPS, ROUTER } = process.env;

async function main() {
    const Handler = await hre.ethers.getContractFactory("Handler");
    const handler = await Handler.deploy(GELATO_OPS, ROUTER);
    await handler.deployed();

    console.log(
        `handler deployed to ${handler.address}`
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
