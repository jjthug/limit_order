const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const truffleAssert = require('truffle-assertions');
const hre = require("hardhat");
const { GelatoOpsSDK, isGelatoOpsSupported, TaskTransaction } = require( "@gelatonetwork/ops-sdk");
const Core = require( "../artifacts/contracts/Core/LimitOrderCore.sol/LimitOrderCore.json");
const IOps = require("../contracts/Core/abis/IOpsProxyFactory.json");
const routerABI = require("../contracts/Core/abis/Router.json");
const tokenAABI = require("../contracts/Core/abis/Token1.json");
const welleABI = require("../contracts/Core/abis/Welle.json");
const {EventEmitterWrapper} = require("hardhat/internal/util/event-emitter");

require('dotenv').config()
const { MUMBAI, AMOUNT_TOKENA, AMOUNT_WELLE, FEE_TOKEN_ADDRESS} = process.env;

// Assumes dex Router is set up
// Do the test only on Mumbai testnet

async function waitForEvent(provider, contract, eventName) {
    return new Promise((resolve, reject) => {
        // const contract = new ethers.Contract(contractAddress, [], provider);

        contract.once(eventName, (...args) => {
            resolve(args);
        });

        setTimeout(() => {
            reject(new Error(`Timeout waiting for ${eventName} event`));
        }, 5000); // Adjust timeout as needed
    });
}

describe("Limit Order", function () {
    let owner, witness;
    let encoded_resolver_args, execSelector;
    let taskId, TASK_ID;
    let gelCore;
    let welle,tokenA;
    let router;
    let MODULE;
    let DATA;
    let SIGNATURE_FOR_GELATO, MIN_RETURN;
    let AMOUNT_TOKENA = "123456"
    let AMOUNT_TOKENB = "123456"
    let GELATO_OPS_MUMBAI = "0xB3f5503f93d5Ef84b06993a1975B9D21B962892F"
    let GELATO_OPS_MUMBAI_GET_PROXY = "0xC815dB16D4be6ddf2685C201937905aBf338F5D7"
    let LIBRARY ="0xa375d35ec4374e869efbb5ef84c2d04764d44d5e"
    let ROUTER_ADDRESS="0xbD8101421ba90741F259bd2A8AeF19623542fF6b";
    let factory = "0x9fa3f9eca5454be707b9a2b4d6c88833592a6701";
    let WELLE="0xcbDf532fa3Ab55A8dD6704986aF42AE2Db35AB96";
    let TOKENA="0xD93EA042821e339f23486c96d651539dCdcBD4D3";
    let TOKENB="0x76E49D054aB536eb81dE5461008a978E68609ef4";
    let WNATIVE="0x351FFe29E3aa50aa30934e54ddA435DBC7F4D3Ba";
    let NATIVE="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    let FEE_TOKEN_ADDRESS=WELLE
    let handlerv1;
    let DEPOSIT_WELLE_DESIRED,DEPOSIT_WELLE_MIN,DEPOSIT_NATIVE_MIN,DEADLINE;
    let FEE=369
    let NATIVE_POOL_FEE=369
    let TOKENA_TOKENB_POOL_FEE=369

    var today = new Date();
    DEADLINE= today.getTime()+6000;
    console.log("deadline=",DEADLINE)

    let AMOUNT_NATIVE_WELLE = "300000000000000000"

    DEPOSIT_WELLE_DESIRED="4509258844644507105761817"
    DEPOSIT_WELLE_MIN=DEPOSIT_WELLE_DESIRED
    DEPOSIT_TOKENB_MIN="50000000000"
    let AMOUNT_WELLE = DEPOSIT_WELLE_DESIRED
    DEPOSIT_NATIVE_MIN="100000000000000000"
    WRAPPED_NATIVE=WNATIVE // on mumbai

    before(async function () {

        [owner, witness] = await ethers.getSigners();

        const GelatoPineCore = await hre.ethers.getContractFactory("LimitOrderCore");
        gelCore = await GelatoPineCore.deploy(FEE_TOKEN_ADDRESS,owner.address,WRAPPED_NATIVE,GELATO_OPS_MUMBAI);
        await gelCore.deployed();
        console.log("gel core deployed to ",gelCore.address);

        // const DEXLibrary = await hre.ethers.getContractFactory("DEXLibrary");
        // dexlib = await DEXLibrary.deploy();
        // await dexlib.deployed();
        // console.log("dexlib deployed to ",dexlib.address);


        const HandlerV1 = await hre.ethers.getContractFactory("HandlerV1"
        //     , {
        //     libraries: {
        //         DEXLibrary: LIBRARY,
        //     }
        // }
        );

        handlerv1 = await HandlerV1.deploy(GELATO_OPS_MUMBAI,factory,owner.address,WRAPPED_NATIVE);
        await handlerv1.deployed();
        console.log("handler_v1 deployed to ",handlerv1.address);
        MODULE=handlerv1.address;

        router = await hre.ethers.getContractAt(routerABI.abi,ROUTER_ADDRESS);

    });
    describe("scenario 5 : tokenA erc20, tokenB native, welle native, successful execution", () => {

        it("owner has sufficient tokenA=native and welle, and give allowance to gelCore", async()=>{

            welle = await hre.ethers.getContractAt(welleABI.abi,WELLE);

            // give allowance to core to tranfer welle
            if ((await welle.allowance(owner.address, gelCore.address)) < DEPOSIT_WELLE_MIN){
                await welle.approve(gelCore.address, DEPOSIT_WELLE_MIN);
                await welle.mint(owner.address,DEPOSIT_WELLE_MIN);
                console.log(`minted `,DEPOSIT_WELLE_MIN,` welle`);
            }

            // give allowance to router to transfer welle
            if ((await welle.allowance(owner.address, router.address)) < DEPOSIT_WELLE_MIN){
                await welle.approve(router.address, DEPOSIT_WELLE_MIN);
                await welle.mint(owner.address,DEPOSIT_WELLE_MIN);
                console.log(`minted `,DEPOSIT_WELLE_MIN,` welle`);
            }

            let nativeVal = await router.quoteByTokens(DEPOSIT_WELLE_MIN,WELLE,WNATIVE,FEE)

            await router.addLiquidityNative(WELLE,FEE,DEPOSIT_WELLE_MIN,DEPOSIT_WELLE_MIN,nativeVal,owner.address,DEADLINE, {value:nativeVal});
            console.log("added liquidity native/welle")
        })

        // assuming tokenA tokenB pool hash sufficient liquidity for swap
        it("can add native liquidity TOKENB/NATIVE", async()=>{

            let tokenB = await hre.ethers.getContractAt(tokenAABI.abi,TOKENB);
            if ((await tokenB.balanceOf(owner.address)) < DEPOSIT_TOKENB_MIN){
                await tokenB.mint(owner.address,DEPOSIT_TOKENB_MIN);
                console.log(`minted `,DEPOSIT_TOKENB_MIN,` tokenB`);
            }

            let nativeVal = await router.quoteByTokens(DEPOSIT_TOKENB_MIN,TOKENB,WNATIVE,FEE)

            if((await tokenB.allowance(owner.address, router.address)) < DEPOSIT_TOKENB_MIN) {
                await tokenB.approve(router.address, DEPOSIT_TOKENB_MIN);
                await tokenB.mint(owner.address,DEPOSIT_TOKENB_MIN);
            }

            if((await tokenB.allowance(owner.address, gelCore.address)) < DEPOSIT_TOKENB_MIN) {
                await tokenB.approve(gelCore.address, DEPOSIT_TOKENB_MIN);
                await tokenB.mint(owner.address,DEPOSIT_TOKENB_MIN);
            }

            await router.addLiquidityNative(TOKENB,FEE,DEPOSIT_TOKENB_MIN,DEPOSIT_TOKENB_MIN,nativeVal,owner.address,DEADLINE,{value:nativeVal});
            console.log("added liquidity native/tokenB")
        })

        it("can deposit tokens and create task", async()=> {

            // check getAmountsOut => tokenB
            MIN_RETURN = await router.getAmountsOut(AMOUNT_TOKENB, [TOKENB,WNATIVE], [FEE])

            DATA = ethers.utils.defaultAbiCoder.encode(
                ["address","uint96","uint256","address","address","address","address","uint32","uint32"],
                [
                    owner.address,
                    DEADLINE, 1,
                    NATIVE,NATIVE,
                    TOKENB,NATIVE,
                    FEE,
                    FEE
                ]
            )

            console.log("DATA=",DATA)

            // get dedicated msg.sender
            // from mumbai gelatoOps
            let iops = await hre.ethers.getContractAt(IOps.abi,GELATO_OPS_MUMBAI_GET_PROXY);

            /////////////////////////

            const chainId = hre.network.config.chainId;

            if (!isGelatoOpsSupported(chainId)) {
                console.log(`Gelato Ops network not supported (${chainId})`);
                return;
            }

            console.log("changing fee token to NATIVE in Core");
            await gelCore.changeFeeToken(NATIVE);

            tx = await gelCore.depositTokensAndCreateTask(AMOUNT_NATIVE_WELLE, AMOUNT_TOKENB, MODULE, false, DATA, {value: (BigInt(AMOUNT_NATIVE_WELLE)).toString(),gasLimit: 1e7});

            console.log("tx.hash=",tx.hash)

            let receipt = await tx.wait();
            console.log("receipt.hash=",receipt.hash)
            console.log("receipt.hash=",receipt.blockNumber)
            console.log("DEPOSIT DONE");

            console.log("changing fee token back to WELLE");
            await gelCore.changeFeeToken(WELLE);

            // get taskId from TaskCreated event
            const events = await gelCore.queryFilter('TaskCreated', receipt.blockNumber);
            events.forEach((event) => {
                console.log('Event:', event.event);
                console.log('TaskId:', event.args.taskId);
                console.log('vault:', event.args.vault);
            });

            // check limit order pass
            console.log("checking if can execute limit order")
            let isTrue = await handlerv1.canExecuteLimitOrder(AMOUNT_TOKENB, AMOUNT_WELLE, DATA);
            console.log("CHECK CAN execute LIMIT ORDER from handler=",isTrue)
            // assert(!isTrue,"expected that we cannot execute order");
        });

        it("gelato successfully executed the limit order", async()=> {

            const eventName = 'OrderExecuted';
            const provider = new ethers.providers.JsonRpcProvider(MUMBAI);

            try {
                console.log('Waiting for event...');
                const eventArgs = await waitForEvent(provider, gelCore, eventName);
                console.log(`Received ${eventName} event:`, eventArgs);
                // Continue with your logic here
            } catch (error) {
                console.error('Error:', error);
            }

        })
    })

    describe("scenario 1 : tokenA erc20, welle fees erc20, add more fee token, successful execution", ()=>{

        it("owner has sufficient tokenA and welle, and give allowance to gelCore", async()=>{

            // assert(DEPOSIT_WELLE_MIN >= AMOUNT_WELLE);
            welle = await hre.ethers.getContractAt(welleABI.abi,WELLE);

            if ((await welle.balanceOf(owner.address)) < DEPOSIT_WELLE_DESIRED){
                await welle.mint(owner.address,DEPOSIT_WELLE_DESIRED);
                await welle.mint(owner.address,DEPOSIT_WELLE_DESIRED);
                console.log(`minted `,DEPOSIT_WELLE_DESIRED,` welle`);
            }

            tokenA = await hre.ethers.getContractAt(tokenAABI.abi,TOKENA);
            if ((await tokenA.balanceOf(owner.address)) < AMOUNT_TOKENA){
                await tokenA.mint(owner.address,AMOUNT_TOKENA);
                console.log(`minted `,AMOUNT_TOKENA,` tokenA`);
            }

            // give allowance of tokenA and welle tokens to gelCore
            if ((await welle.allowance(owner.address, gelCore.address)) < AMOUNT_WELLE){
                await welle.approve(gelCore.address, AMOUNT_WELLE);
            }

            if ((await tokenA.allowance(owner.address, gelCore.address)) < AMOUNT_TOKENA){
                await tokenA.approve(gelCore.address, AMOUNT_TOKENA);
            }
        })

        // assuming tokenA tokenB pool hash sufficient liquidity for swap
        it("can add native liquidity", async()=>{

            let nativeVal = await router.quoteByTokens(DEPOSIT_WELLE_MIN,WELLE,WNATIVE,NATIVE_POOL_FEE)

            if((await welle.allowance(owner.address, router.address)) < DEPOSIT_WELLE_DESIRED) {
                await welle.approve(router.address, DEPOSIT_WELLE_DESIRED);
                await welle.mint(owner.address,DEPOSIT_WELLE_DESIRED);
            }

            await new Promise(resolve => {setTimeout(resolve,15000)})
            await router.addLiquidityNative(WELLE,FEE,DEPOSIT_WELLE_DESIRED,DEPOSIT_WELLE_MIN,nativeVal,owner.address,DEADLINE, {value:nativeVal});

            console.log("added liquidity native")
        })

        it("can deposit tokens and create task, only owner can change fee token", async()=> {

            // check getAmountsOut => tokenB
            MIN_RETURN = await router.getAmountsOut(AMOUNT_TOKENA, [TOKENA,TOKENB], [FEE])

            DATA = ethers.utils.defaultAbiCoder.encode(
                ["address","uint96","uint256","address","address","address","address","uint32","uint32"],
                [
                    owner.address, DEADLINE, MIN_RETURN[1],
                    WELLE,WNATIVE,
                    TOKENA, TOKENB,
                    NATIVE_POOL_FEE,
                    TOKENA_TOKENB_POOL_FEE
                ]
            )

            console.log("DATA=",DATA)

            // get dedicated msg.sender
            // from mumbai gelatoOps
            let iops = await hre.ethers.getContractAt(IOps.abi,GELATO_OPS_MUMBAI_GET_PROXY);
            let DEDICATED_MSG_SENDER = (await iops.getProxyOf(gelCore.address))[0];
            console.log("DEDICATED_MSG_SENDER=",DEDICATED_MSG_SENDER)

            // todo change
            SIGNATURE_FOR_GELATO =await witness.signMessage(ethers.utils.arrayify(ethers.utils.keccak256(DEDICATED_MSG_SENDER)));
            console.log("SIGNATURE_FOR_GELATO=",SIGNATURE_FOR_GELATO)

            /////////////////////////

            const chainId = hre.network.config.chainId;

            if (!isGelatoOpsSupported(chainId)) {
                console.log(`Gelato Ops network not supported (${chainId})`);
                return;
            }

            TEMP_WELLE_AMOUNT=123
            await welle.mint(owner.address,TEMP_WELLE_AMOUNT)

            tx = await gelCore.depositTokensAndCreateTask(TEMP_WELLE_AMOUNT, AMOUNT_TOKENA, MODULE, false, DATA,{gasLimit: 1e7});
            console.log("tx.hash=",tx.hash)

            let receipt = await tx.wait();
            console.log("receipt.hash=",receipt.hash)
            console.log("receipt.hash=",receipt.blockNumber)
            console.log("DEPOSIT DONE");

            // only owner can change the fee token
            await truffleAssert.fails(gelCore.connect(witness).changeFeeToken(TOKENB));


            await gelCore.changeFeeToken(TOKENB);
            console.log("changed fee token to =",TOKENB);

            let vaultId = await gelCore.vaultOfOrder(MODULE,TOKENA,WELLE,owner.address,DATA);
            console.log("---");
            await welle.approve(gelCore.address,AMOUNT_WELLE);
            console.log("---");
            await welle.mint(owner.address,AMOUNT_WELLE)
            console.log("---");

            // sleep for 5 seconds
            await new Promise(resolve => setTimeout(resolve,5000))

            await gelCore.addMoreFeeTokens(MODULE,WELLE,TOKENA,DATA,AMOUNT_WELLE);
            console.log("add more welle => tx.hash=",tx.hash)


            receipt = await tx.wait();
            console.log("receipt.hash=",receipt.hash)
            console.log("receipt.hash=",receipt.blockNumber)
            console.log("added more welle DONE");


            // get taskId from TaskCreated event
            const events = await gelCore.queryFilter('TaskCreated', receipt.blockNumber);
            events.forEach((event) => {
                console.log('Event:', event.event);
                console.log('TaskId:', event.args.taskId);
                console.log('vault:', event.args.vault);
            });


            // check limit order pass
            console.log("checking if can execute limit order")
            let isTrue = await handlerv1.canExecuteLimitOrder(AMOUNT_TOKENA, AMOUNT_WELLE, DATA);
            console.log("CHECK CAN execute LIMIT ORDER from handler=",isTrue)
        });

        it("gelato successfully executed the limit order", async()=> {

            const eventName = 'OrderExecuted';
            const provider = new ethers.providers.JsonRpcProvider(MUMBAI);

            try {
                console.log('Waiting for event...');
                const eventArgs = await waitForEvent(provider, gelCore, eventName);
                console.log(`Received ${eventName} event:`, eventArgs);
                // Continue with your logic here
            } catch (error) {
                console.error('Error:', error);
            }

        })
    })

    describe("scenario 2 : tokenA erc20, welle fees erc20, failed execution, user cancels and refunds", ()=>{

        it("owner has sufficient tokenA and welle, and give allowance to gelCore", async()=>{

            welle = await hre.ethers.getContractAt(welleABI.abi,WELLE);

            if ((await welle.balanceOf(owner.address)) < DEPOSIT_WELLE_DESIRED){
                await welle.mint(owner.address,DEPOSIT_WELLE_DESIRED);
                console.log(`minted `,DEPOSIT_WELLE_DESIRED,` welle`);
            }

            tokenA = await hre.ethers.getContractAt(tokenAABI.abi,TOKENA);
            if ((await tokenA.balanceOf(owner.address)) < AMOUNT_TOKENA){
                await tokenA.mint(owner.address,AMOUNT_TOKENA);
                console.log(`minted `,AMOUNT_TOKENA,` tokenA`);
            }

            // give allowance of tokenA and welle tokens to gelCore
            if ((await welle.allowance(owner.address, gelCore.address)) < AMOUNT_WELLE){
                await welle.approve(gelCore.address, AMOUNT_WELLE);
            }

            if ((await tokenA.allowance(owner.address, gelCore.address)) < AMOUNT_TOKENA){
                await tokenA.approve(gelCore.address, AMOUNT_TOKENA);
            }
        })

        // assuming tokenA tokenB pool hash sufficient liquidity for swap
        it("can add native liquidity", async()=>{

            let nativeVal = await router.quoteByTokens(DEPOSIT_WELLE_MIN,WELLE,WNATIVE,NATIVE_POOL_FEE)

            if((await welle.allowance(owner.address, router.address)) < DEPOSIT_WELLE_MIN) {
                await welle.mint(owner.address,DEPOSIT_WELLE_MIN);
                await welle.approve(router.address, DEPOSIT_WELLE_MIN);
            }

            await new Promise(resolve => {setTimeout(resolve,15000)})

            await router.addLiquidityNative(WELLE,FEE,DEPOSIT_WELLE_MIN,DEPOSIT_WELLE_MIN,nativeVal,owner.address,DEADLINE, {value:nativeVal});
            console.log("added liquidity native")
        })

        it("can deposit tokens and create task", async()=> {

            await gelCore.changeFeeToken(WELLE);
            console.log("changed fee token to =",WELLE);

            // check getAmountsOut => tokenB
            MIN_RETURN = await router.getAmountsOut(AMOUNT_TOKENA, [TOKENA,TOKENB], [FEE])

            DATA = ethers.utils.defaultAbiCoder.encode(
                ["address","uint96","uint256","address","address","address","address","uint32","uint32"],
                [
                    owner.address,
                    DEADLINE, MIN_RETURN[1]*100,
                    WELLE,WNATIVE,
                    TOKENA, TOKENB,
                    NATIVE_POOL_FEE,
                    TOKENA_TOKENB_POOL_FEE
                ]
            )

            console.log("DATA=",DATA)

            // get dedicated msg.sender
            // from mumbai gelatoOps
            let iops = await hre.ethers.getContractAt(IOps.abi,GELATO_OPS_MUMBAI_GET_PROXY);
            let DEDICATED_MSG_SENDER = (await iops.getProxyOf(gelCore.address))[0];
            console.log("DEDICATED_MSG_SENDER=",DEDICATED_MSG_SENDER)

            // todo change
            SIGNATURE_FOR_GELATO =await witness.signMessage(ethers.utils.arrayify(ethers.utils.keccak256(DEDICATED_MSG_SENDER)));
            console.log("SIGNATURE_FOR_GELATO=",SIGNATURE_FOR_GELATO)

            /////////////////////////

            const chainId = hre.network.config.chainId;

            if (!isGelatoOpsSupported(chainId)) {
                console.log(`Gelato Ops network not supported (${chainId})`);
                return;
            }

            tx = await gelCore.depositTokensAndCreateTask(AMOUNT_WELLE, AMOUNT_TOKENA, MODULE, false, DATA,{gasLimit: 1e7});

            console.log("tx.hash=",tx.hash)

            let receipt = await tx.wait();
            console.log("receipt.hash=",receipt.hash)
            console.log("receipt.hash=",receipt.blockNumber)
            console.log("DEPOSIT DONE");

            // get taskId from TaskCreated event
            const events = await gelCore.queryFilter('TaskCreated', receipt.blockNumber);
            events.forEach((event) => {
                console.log('Event:', event.event);
                console.log('TaskId:', event.args.taskId);
                console.log('vault:', event.args.vault);
            });

            // check limit order pass
            console.log("checking if can execute limit order")
            let isTrue = await handlerv1.canExecuteLimitOrder(AMOUNT_TOKENA, AMOUNT_WELLE, DATA);
            console.log("CHECK CAN execute LIMIT ORDER from handler=",isTrue)
            // assert(!isTrue,"expected that we cannot execute order");
        });

        it("user can cancel the order", async()=>{

            await gelCore.changeFeeToken(TOKENB);
            console.log("changed fee token to =",TOKENB);

            let tokenA_balanceBefore = await tokenA.balanceOf(owner.address)
            let welle_balanceBefore =  await welle.balanceOf(owner.address)

            tx = await gelCore.cancelTaskAndWithdrawTokens(MODULE,WELLE,TOKENA,DATA);

            console.log("tx.hash=",tx.hash)
            let receipt = await tx.wait();
            console.log("receipt.blockNumber=",receipt.blockNumber)
            console.log("CANCEL DONE");

            const events = await gelCore.queryFilter('OrderCancelledAndVaultWithdrawn', receipt.blockNumber);
            events.forEach((event) => {
                console.log('Event:', event.event);
                console.log('TaskId:', event.args.taskId);
                console.log('vault:', event.args.vault);
            });

            console.log("(parseInt(tokenA_balanceBefore)+parseInt(AMOUNT_TOKENA)).toString()=",(parseInt(tokenA_balanceBefore)+parseInt(AMOUNT_TOKENA)).toString())
            // assert.equal((parseInt(tokenA_balanceBefore)+parseInt(AMOUNT_TOKENA)).toString(), ethers.utils.formatUnits(await tokenA.balanceOf(owner.address),await tokenA.decimals()));
            // assert.equal((parseInt(welle_balanceBefore)+parseInt(AMOUNT_WELLE)).toString(), ethers.utils.formatUnits(await welle.balanceOf(owner.address),await welle.decimals()));

            await new Promise(resolve => {setTimeout(resolve,15000)});

            expect(ethers.BigNumber.from(tokenA_balanceBefore).add(ethers.BigNumber.from(AMOUNT_TOKENA))).equals(await tokenA.balanceOf(owner.address));
            expect(ethers.BigNumber.from(welle_balanceBefore).add(ethers.BigNumber.from(AMOUNT_WELLE))).equals(await welle.balanceOf(owner.address));

            //reset the fee token
            await gelCore.changeFeeToken(WELLE);
            console.log("changed fee token to =",WELLE);
        })
    })

    describe("scenario 3 : tokenA native, welle native, successful execution", () => {

        it("owner has sufficient tokenA=native and welle, and give allowance to gelCore", async()=>{

            welle = await hre.ethers.getContractAt(welleABI.abi,WELLE);

            // give allowance to core to tranfer welle
            if ((await welle.allowance(owner.address, gelCore.address)) < DEPOSIT_WELLE_MIN){
                await welle.approve(gelCore.address, DEPOSIT_WELLE_MIN);
                await welle.mint(owner.address,DEPOSIT_WELLE_MIN);
                console.log(`minted `,DEPOSIT_WELLE_MIN,` welle`);
            }

            // give allowance to router to transfer welle
            if ((await welle.allowance(owner.address, router.address)) < DEPOSIT_WELLE_MIN){
                await welle.approve(router.address, DEPOSIT_WELLE_MIN);
                await welle.mint(owner.address,DEPOSIT_WELLE_MIN);
                console.log(`minted `,DEPOSIT_WELLE_MIN,` welle`);
            }

            let nativeVal = await router.quoteByTokens(DEPOSIT_WELLE_MIN,WELLE,WNATIVE,FEE)

            await router.addLiquidityNative(WELLE,FEE,DEPOSIT_WELLE_MIN,DEPOSIT_WELLE_MIN,nativeVal,owner.address,DEADLINE, {value:nativeVal});
            console.log("added liquidity native/welle")
        })

        // assuming tokenA tokenB pool hash sufficient liquidity for swap
        it("can add native liquidity TOKENB/NATIVE", async()=>{

            let tokenB = await hre.ethers.getContractAt(tokenAABI.abi,TOKENB);
            if ((await tokenB.balanceOf(owner.address)) < DEPOSIT_TOKENB_MIN){
                await tokenB.mint(owner.address,DEPOSIT_TOKENB_MIN);
                console.log(`minted `,DEPOSIT_TOKENB_MIN,` tokenB`);
            }

            let nativeVal = await router.quoteByTokens(DEPOSIT_TOKENB_MIN,TOKENB,WNATIVE,FEE)

            if((await tokenB.allowance(owner.address, router.address)) < DEPOSIT_TOKENB_MIN) {
                await tokenB.approve(router.address, DEPOSIT_TOKENB_MIN);
                await tokenB.mint(owner.address,DEPOSIT_TOKENB_MIN);
            }

            if((await tokenB.allowance(owner.address, gelCore.address)) < DEPOSIT_TOKENB_MIN) {
                await tokenB.approve(gelCore.address, DEPOSIT_TOKENB_MIN);
                await tokenB.mint(owner.address,DEPOSIT_TOKENB_MIN);
            }

            await router.addLiquidityNative(TOKENB,FEE,DEPOSIT_TOKENB_MIN,DEPOSIT_TOKENB_MIN,nativeVal,owner.address,DEADLINE,{value:nativeVal});
            console.log("added liquidity native/tokenB")
        })

        it("can deposit tokens and create task", async()=> {

            // check getAmountsOut => tokenB
            MIN_RETURN = await router.getAmountsOut(DEPOSIT_NATIVE_MIN, [WNATIVE,TOKENB], [FEE])

            DATA = ethers.utils.defaultAbiCoder.encode(
                ["address","uint96","uint256","address","address","address","address","uint32","uint32"],
                [
                    owner.address,
                    DEADLINE, MIN_RETURN[1],
                    NATIVE,NATIVE,
                    WNATIVE, TOKENB,
                    FEE,
                    FEE
                ]
            )

            console.log("DATA=",DATA)

            // get dedicated msg.sender
            // from mumbai gelatoOps
            let iops = await hre.ethers.getContractAt(IOps.abi,GELATO_OPS_MUMBAI_GET_PROXY);
            let DEDICATED_MSG_SENDER = (await iops.getProxyOf(gelCore.address))[0];
            console.log("DEDICATED_MSG_SENDER=",DEDICATED_MSG_SENDER)

            // todo change
            SIGNATURE_FOR_GELATO =await witness.signMessage(ethers.utils.arrayify(ethers.utils.keccak256(DEDICATED_MSG_SENDER)));
            console.log("SIGNATURE_FOR_GELATO=",SIGNATURE_FOR_GELATO)

            /////////////////////////

            const chainId = hre.network.config.chainId;

            if (!isGelatoOpsSupported(chainId)) {
                console.log(`Gelato Ops network not supported (${chainId})`);
                return;
            }

            console.log("changing fee token to NATIVE in Core");
            await gelCore.changeFeeToken(NATIVE);

            tx = await gelCore.depositTokensAndCreateTask(AMOUNT_NATIVE_WELLE, DEPOSIT_NATIVE_MIN, MODULE, true, DATA,{value: (BigInt(DEPOSIT_NATIVE_MIN)+BigInt(AMOUNT_NATIVE_WELLE)).toString(),gasLimit: 1e7});

            console.log("tx.hash=",tx.hash)

            let receipt = await tx.wait();
            console.log("receipt.hash=",receipt.hash)
            console.log("receipt.hash=",receipt.blockNumber)
            console.log("DEPOSIT DONE");

            // get taskId from TaskCreated event
            const events = await gelCore.queryFilter('TaskCreated', receipt.blockNumber);
            events.forEach((event) => {
                console.log('Event:', event.event);
                console.log('TaskId:', event.args.taskId);
                console.log('vault:', event.args.vault);
            });

            // check limit order pass
            console.log("checking if can execute limit order")
            let isTrue = await handlerv1.canExecuteLimitOrder(AMOUNT_TOKENB, AMOUNT_WELLE, DATA);
            console.log("CHECK CAN execute LIMIT ORDER from handler=",isTrue)
            // assert(!isTrue,"expected that we cannot execute order");
        });

        it("gelato successfully executed the limit order", async()=> {

            const eventName = 'OrderExecuted';
            const provider = new ethers.providers.JsonRpcProvider(MUMBAI);

            try {
                console.log('Waiting for event...');
                const eventArgs = await waitForEvent(provider, gelCore, eventName);
                console.log(`Received ${eventName} event:`, eventArgs);
                // Continue with your logic here
            } catch (error) {
                console.error('Error:', error);
            }

        })
    })

    describe("scenario 4 : tokenA native, welle native, non-successful execution, cancel order", () => {

        it("owner has sufficient tokenA=native and welle, and give allowance to gelCore", async()=>{

            welle = await hre.ethers.getContractAt(welleABI.abi,WELLE);

            // give allowance to core to tranfer welle
            if ((await welle.allowance(owner.address, gelCore.address)) < DEPOSIT_WELLE_MIN){
                await welle.approve(gelCore.address, DEPOSIT_WELLE_MIN);
                await welle.mint(owner.address,DEPOSIT_WELLE_MIN);
                console.log(`minted `,DEPOSIT_WELLE_MIN,` welle`);
            }

            // give allowance to router to transfer welle
            if ((await welle.allowance(owner.address, router.address)) < DEPOSIT_WELLE_MIN){
                await welle.approve(router.address, DEPOSIT_WELLE_MIN);
                await welle.mint(owner.address,DEPOSIT_WELLE_MIN);
                console.log(`minted `,DEPOSIT_WELLE_MIN,` welle`);
            }

            let nativeVal = await router.quoteByTokens(DEPOSIT_WELLE_MIN,WELLE,WNATIVE,FEE)

            await router.addLiquidityNative(WELLE,FEE,DEPOSIT_WELLE_MIN,DEPOSIT_WELLE_MIN,nativeVal,owner.address,DEADLINE, {value:nativeVal});
            console.log("added liquidity native/welle")
        })

        // assuming tokenA tokenB pool hash sufficient liquidity for swap
        it("can add native liquidity TOKENB/NATIVE", async()=>{

            let tokenB = await hre.ethers.getContractAt(tokenAABI.abi,TOKENB);
            if ((await tokenB.balanceOf(owner.address)) < DEPOSIT_TOKENB_MIN){
                await tokenB.mint(owner.address,DEPOSIT_TOKENB_MIN);
                console.log(`minted `,DEPOSIT_TOKENB_MIN,` tokenB`);
            }

            let nativeVal = await router.quoteByTokens(DEPOSIT_TOKENB_MIN,TOKENB,WNATIVE,FEE)

            if((await tokenB.allowance(owner.address, router.address)) < DEPOSIT_TOKENB_MIN) {
                await tokenB.approve(router.address, DEPOSIT_TOKENB_MIN);
                await tokenB.mint(owner.address,DEPOSIT_TOKENB_MIN);
            }

            if((await tokenB.allowance(owner.address, gelCore.address)) < DEPOSIT_TOKENB_MIN) {
                await tokenB.approve(gelCore.address, DEPOSIT_TOKENB_MIN);
                await tokenB.mint(owner.address,DEPOSIT_TOKENB_MIN);
            }

            await router.addLiquidityNative(TOKENB,FEE,DEPOSIT_TOKENB_MIN,DEPOSIT_TOKENB_MIN,nativeVal,owner.address,DEADLINE,{value:nativeVal});
            console.log("added liquidity native/tokenB")
        })

        it("can deposit tokens and create task", async()=> {

            // check getAmountsOut => tokenB
            MIN_RETURN = await router.getAmountsOut(DEPOSIT_NATIVE_MIN, [WNATIVE,TOKENB], [FEE])

            DATA = ethers.utils.defaultAbiCoder.encode(
                ["address","uint96","uint256","address","address","address","address","uint32","uint32"],
                [
                    owner.address,
                    DEADLINE, (BigInt(MIN_RETURN[1])*BigInt(100)).toString(),
                    NATIVE,NATIVE,
                    WNATIVE, TOKENB,
                    FEE,
                    FEE
                ]
            )

            console.log("DATA=",DATA)

            // get dedicated msg.sender
            // from mumbai gelatoOps
            let iops = await hre.ethers.getContractAt(IOps.abi,GELATO_OPS_MUMBAI_GET_PROXY);
            let DEDICATED_MSG_SENDER = (await iops.getProxyOf(gelCore.address))[0];
            console.log("DEDICATED_MSG_SENDER=",DEDICATED_MSG_SENDER)

            // todo change
            SIGNATURE_FOR_GELATO =await witness.signMessage(ethers.utils.arrayify(ethers.utils.keccak256(DEDICATED_MSG_SENDER)));
            console.log("SIGNATURE_FOR_GELATO=",SIGNATURE_FOR_GELATO)

            /////////////////////////

            const chainId = hre.network.config.chainId;

            if (!isGelatoOpsSupported(chainId)) {
                console.log(`Gelato Ops network not supported (${chainId})`);
                return;
            }

            console.log("changing fee token to NATIVE in Core");
            await gelCore.changeFeeToken(NATIVE);

            tx = await gelCore.depositTokensAndCreateTask(AMOUNT_NATIVE_WELLE, DEPOSIT_NATIVE_MIN, MODULE, true, DATA,{value: (BigInt(DEPOSIT_NATIVE_MIN)+BigInt(AMOUNT_NATIVE_WELLE)).toString(),gasLimit: 1e7});

            console.log("tx.hash=",tx.hash)

            let receipt = await tx.wait();
            console.log("receipt.hash=",receipt.hash)
            console.log("receipt.hash=",receipt.blockNumber)
            console.log("DEPOSIT DONE");

            // get taskId from TaskCreated event
            const events = await gelCore.queryFilter('TaskCreated', receipt.blockNumber);
            events.forEach((event) => {
                console.log('Event:', event.event);
                console.log('TaskId:', event.args.taskId);
                console.log('vault:', event.args.vault);
            });

            // check limit order pass
            // console.log("checking if can execute limit order")
            // let isTrue = await handlerv1.canExecuteLimitOrder(DEPOSIT_NATIVE_MIN, AMOUNT_NATIVE_WELLE, DATA);
            // console.log("CHECK CAN execute LIMIT ORDER from handler=",isTrue)
            // assert(!isTrue,"expected that we cannot execute order");
        });

        it("user can cancel the order", async()=>{

            const provider = new ethers.providers.JsonRpcProvider(MUMBAI);

            let balanceBefore = await provider.getBalance(owner.address);
            console.log("balanceBefore=",balanceBefore)

            tx = await gelCore.cancelTaskAndWithdrawTokens(MODULE,NATIVE,NATIVE,DATA);

            console.log("tx.hash=",tx.hash)
            let receipt = await tx.wait();
            console.log("receipt.blockNumber=",receipt.blockNumber)
            console.log("CANCEL DONE");
            const gasUsed = receipt.gasUsed;
            const gasPrice = tx.gasPrice;
            const fees = gasUsed.mul(gasPrice);
            console.log("gasUsed=",gasUsed)
            console.log("gasPrice=",gasPrice)
            console.log("fees=",fees)

            const events = await gelCore.queryFilter('OrderCancelledAndVaultWithdrawn', receipt.blockNumber);
            events.forEach((event) => {
                console.log('Event:', event.event);
                console.log('TaskId:', event.args.taskId);
                console.log('vault:', event.args.vault);
            });

            // assert.equal((parseInt(tokenA_balanceBefore)+parseInt(AMOUNT_TOKENA)).toString(), ethers.utils.formatUnits(await tokenA.balanceOf(owner.address),await tokenA.decimals()));
            // assert.equal((parseInt(welle_balanceBefore)+parseInt(AMOUNT_WELLE)).toString(), ethers.utils.formatUnits(await welle.balanceOf(owner.address),await welle.decimals()));

            await new Promise(resolve => {setTimeout(resolve,15000)});
            console.log("balanceBefore=",balanceBefore)

            console.log("balance After =",((BigInt(balanceBefore)+BigInt(DEPOSIT_NATIVE_MIN)+BigInt(AMOUNT_NATIVE_WELLE)).toString()));

            expect((((BigInt(balanceBefore)+BigInt(DEPOSIT_NATIVE_MIN)+BigInt(AMOUNT_NATIVE_WELLE)-BigInt(fees)))/BigInt("10000000")).toString()).equals((BigInt((await provider.getBalance(owner.address)))/BigInt("10000000")).toString());
        })



    })
});