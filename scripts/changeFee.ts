const hre = require("hardhat");
// Process Env Variables
require('dotenv').config()

async function main() {
    let [owner, witness] = await hre.ethers.getSigners();

    let GELATO_PINE_CORE = "0xcbDf532fa3Ab55A8dD6704986aF42AE2Db35AB96";

    const GelatoPineCore = await hre.ethers.getContractFactory("LimitOrderCore");
    let gelato = await GelatoPineCore.attach("0x8148c924eda0a7f4F734E4055E4B06Cfa9e96A8b");
    // console.log(await gelato.getOwner());

    console.log("owner=",owner.address);
    await gelato.connect(owner).changeFeeToken(GELATO_PINE_CORE);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
