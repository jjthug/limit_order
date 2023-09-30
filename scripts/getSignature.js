const {ethers} = require("hardhat")
const hre = require("hardhat");

require('dotenv').config()
const { TOKEN1,TOKEN2,WELLE,WRAPPED_NATIVE,FEE,DEADLINE} = process.env;
// let DEDICATED_MSG_SENDER="0x078a03B118a872C113E01faF2b0A7ed9acE3b879"
let DEDICATED_MSG_SENDER="0x756eC417C5571813DbbC67487F11E4778de9Cd29"

let MIN_RETURN="100456"

let TOKEN_A=TOKEN1
let TOKEN_B=TOKEN2

let NATIVE=WRAPPED_NATIVE

let NATIVE_POOL_FEE=FEE
let TOKENA_TOKENB_POOL_FEE=FEE

let hash = ethers.utils.keccak256(DEDICATED_MSG_SENDER)
console.log("hash=",hash)

let encoded = ethers.utils.defaultAbiCoder.encode(
    ["uint96","uint256","address[]","address[]","uint32[]","uint32[]"],
    [
        DEADLINE, MIN_RETURN,
        [WELLE,NATIVE],
        [TOKEN_A, TOKEN_B],
        [NATIVE_POOL_FEE],
        [TOKENA_TOKENB_POOL_FEE]
    ]
)
console.log(encoded);

async function main() {
    const [signerz,signer] = await hre.ethers.getSigners();

    console.log(await signer.signMessage(ethers.utils.arrayify(hash)));
}

main();
