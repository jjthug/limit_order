const limitOrderGelatoCore = require( "../artifacts/contracts/Core/LimitOrderCore.sol/LimitOrderCore.json");

const hre = require("hardhat");
const {ethers} = require("hardhat");

async function main() {
    [signer] = await ethers.getSigners();

    const routerChecker = new hre.ethers.Contract("0x756eC417C5571813DbbC67487F11E4778de9Cd29", limitOrderGelatoCore.abi, signer);
    const execSelector = routerChecker.interface.getSighash("executeLimitOrder(address,address,address,bytes,bytes)");

    const MODULE = "0x6987bb165f043bdcaf30f0c460a16ad222c1e5312039ba5733891642a3003ab3"
    const MODULE1 = "0x6987bb165f043bdcaf30f0c460a16ad222c1e5312039ba5733891642a3003ab3"
    const resolver = routerChecker.interface.getSighash("canExecuteLimitOrder(bytes32,bytes32)");
    const resolverData = routerChecker.interface.encodeFunctionData("canExecuteLimitOrder", [MODULE, MODULE1])

    console.log(resolverData)
}

main()