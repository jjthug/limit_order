const hre = require("hardhat");
const {ethers} = require("hardhat");
const limitOrderGelatoCore = require("../artifacts/contracts/Core/GelatoPineCore.sol/GelatoPineCore.json");
const IOps = require("../contracts/Core/abis/IOpsProxyFactory.json");
const welleABI = require("../contracts/Core/abis/Welle.json");
const tokenAABI = require("../contracts/Core/abis/Token1.json");
// Process Env Variables
require('dotenv').config()
const { MODULE } = process.env;

async function main() {
    let GELCORE_ADDRESS="0xb3b91e1FE405E6b7ba05C78720159507c1EB12B8"
    let [owner, witness] = await ethers.getSigners();
    let TOKENA="0xD93EA042821e339f23486c96d651539dCdcBD4D3";
    let WRAPPED_NATIVE="0x90edFf65C3fFD16dD7BcC44640FC8e2f7A0e25D5";
    let DEADLINE= new Date().getTime()+600;
    let WELLE="0xcbDf532fa3Ab55A8dD6704986aF42AE2Db35AB96";
    let WNATIVE="0x351FFe29E3aa50aa30934e54ddA435DBC7F4D3Ba";
    let TOKENB="0x76E49D054aB536eb81dE5461008a978E68609ef4";
    let NATIVE_POOL_FEE=369
    let TOKENA_TOKENB_POOL_FEE=369
    let FEE_TOKEN_ADDRESS=WELLE
    let AMOUNT_TOKENA = "123456"
    let AMOUNT_WELLE = "4509258844644507105761817"
    let GELATO_OPS_MUMBAI_GETPROXYOF = "0xC815dB16D4be6ddf2685C201937905aBf338F5D7"
    let GELATO_OPS_MUMBAI = "0xB3f5503f93d5Ef84b06993a1975B9D21B962892F"
    let DEPOSIT_WELLE_DESIRED="1000000000000000000000000"
    let DEPOSIT_WELLE_MIN="1000000000000000000000000"
    let DATA = ethers.utils.defaultAbiCoder.encode(
        ["uint96","uint256","address[]","address[]","uint32[]","uint32[]"],
        [
            DEADLINE, 1,
            [WELLE,WNATIVE],
            [TOKENA, TOKENB],
            [NATIVE_POOL_FEE],
            [TOKENA_TOKENB_POOL_FEE]
        ]
    )



    // deploy
    // const GelatoPineCore = await hre.ethers.getContractFactory("GelatoPineCore");
    // let gelCore = await GelatoPineCore.deploy(FEE_TOKEN_ADDRESS,owner.address,WRAPPED_NATIVE,GELATO_OPS_MUMBAI);
    // console.log("gelcore address=",gelCore.address)

    let gelCore = await hre.ethers.getContractAt(limitOrderGelatoCore.abi,GELCORE_ADDRESS);

    let iops = await hre.ethers.getContractAt(IOps.abi,GELATO_OPS_MUMBAI_GETPROXYOF);
    let DEDICATED_MSG_SENDER = (await iops.getProxyOf(gelCore.address))[0];
    // let DEDICATED_MSG_SENDER = (await iops.getProxyOf(owner.address))[0];
    let SIGNATURE_FOR_GELATO =await witness.signMessage(ethers.utils.arrayify(DEDICATED_MSG_SENDER));

    console.log("DEDICATED_MSG_SENDER=",DEDICATED_MSG_SENDER)

    //===============

    const routerChecker = new hre.ethers.Contract(gelCore.address, limitOrderGelatoCore.abi, owner);
    const execSelector = routerChecker.interface.getSighash("executeLimitOrder(address,address,address,bytes,bytes)");

    const resolver = routerChecker.interface.getSighash("canExecuteLimitOrder(address,address,address,address,bytes,bytes)");
    const resolverData = routerChecker.interface.encodeFunctionData("canExecuteLimitOrder",[MODULE, TOKENA, owner.address, witness.address, DATA, SIGNATURE_FOR_GELATO])

    let welle = await hre.ethers.getContractAt(welleABI.abi,WELLE);
    let tokenA = await hre.ethers.getContractAt(tokenAABI.abi,TOKENA);

    if ((await welle.balanceOf(owner.address)) < AMOUNT_WELLE){
        await welle.mint(owner.address,DEPOSIT_WELLE_MIN);
        console.log(`minted `,DEPOSIT_WELLE_MIN,` welle`);
    }

    if ((await tokenA.balanceOf(owner.address)) < AMOUNT_TOKENA){
        await tokenA.mint(owner.address,AMOUNT_TOKENA);
        console.log(`minted `,AMOUNT_TOKENA,` tokenA`);
    }

    // give allowance of tokenA and welle tokens to gelCore
    if ((await welle.allowance(owner.address, GELCORE_ADDRESS)) < AMOUNT_WELLE){
        await welle.approve(GELCORE_ADDRESS, AMOUNT_WELLE);
    }

    if ((await tokenA.allowance(owner.address, GELCORE_ADDRESS)) < AMOUNT_TOKENA){
        await tokenA.approve(GELCORE_ADDRESS, AMOUNT_TOKENA);
    }

    console.log("AMOUNT_WELLE=",AMOUNT_WELLE)
    console.log("AMOUNT_TOKENA=",AMOUNT_TOKENA)
    console.log("MODULE=",MODULE)
    console.log("TOKENA=",TOKENA)
    console.log("owner=",owner.address)
    console.log("witness=",witness.address)
    console.log("moduleData=",[[0,2,3],[resolverData,'0x','0x']])
    console.log("execSelector=",execSelector)
    console.log("DATA=",DATA)
    console.log("SIGNATURE_FOR_GELATO=",SIGNATURE_FOR_GELATO)

    // let tx = await gelCore.depositTokensAndCreateTask(AMOUNT_WELLE, AMOUNT_TOKENA, MODULE, TOKENA, owner.address, witness.address,[[0,2,3],[resolverData,'0x','0x']], execSelector, DATA);
    console.log("tx.hash=",tx.hash)
    let receipt = await tx.wait();
    console.log("receipt.hash=",receipt.hash)
    console.log("DEPOSIT DONE");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
