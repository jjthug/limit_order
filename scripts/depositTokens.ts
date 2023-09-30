const hre = require("hardhat");
// Process Env Variables
require('dotenv').config()
const { GELATO_PINE_CORE, AMOUNT_WELLE, AMOUNT_TOKENA, MODULE, TOKENA, OWNER, WITNESS, DATA } = process.env;

async function main() {

    let Gelato = await hre.ethers.getContractFactory("GelatoPineCore");
    let gelato = await Gelato.attach(GELATO_PINE_CORE);

    let tx = await gelato.depositTokens(AMOUNT_WELLE, AMOUNT_TOKENA, MODULE, TOKENA, OWNER, WITNESS, DATA);
    console.log("tx.hash=",tx.hash)
    let receipt = await tx.wait();
    console.log("receipt.hash=",receipt.hash)
    console.log("DEPOSIT DONE");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});