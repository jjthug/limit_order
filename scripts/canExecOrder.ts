const hre = require("hardhat");
// Process Env Variables
require('dotenv').config()
const { GELATO_PINE_CORE, MODULE, TOKENA, OWNER, WITNESS, DATA, SIGNATURE, SIGNATURE_FOR_GELATO } = process.env;

async function main() {

    console.log(await hre.ethers.getDefaultProvider().getNetwork())
    let Gelato = await hre.ethers.getContractFactory("GelatoPineCore");
    let gelato = await Gelato.attach(GELATO_PINE_CORE);

    console.log("can exec order =",await gelato.canExecuteOrder(MODULE, TOKENA, OWNER, WITNESS, DATA, SIGNATURE));

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
