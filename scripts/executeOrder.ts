const hre = require("hardhat");
// Process Env Variables
require('dotenv').config()
const { GELATO_PINE_CORE, MODULE, TOKENA, OWNER, DATA, SIGNATURE, SIGNATURE_FOR_GELATO } = process.env;

async function main() {

    let Gelato = await hre.ethers.getContractFactory("GelatoPineCore");
    let gelato = await Gelato.attach(GELATO_PINE_CORE);

    await gelato.executeOrder2(MODULE, TOKENA, OWNER, DATA, SIGNATURE);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
