const {ethers} = require("hardhat");


let WELLE="0xcbDf532fa3Ab55A8dD6704986aF42AE2Db35AB96";
let TOKENA="0xD93EA042821e339f23486c96d651539dCdcBD4D3";
let TOKENB="0x76E49D054aB536eb81dE5461008a978E68609ef4";
let WNATIVE="0x351FFe29E3aa50aa30934e54ddA435DBC7F4D3Ba";
let NATIVE_POOL_FEE=369
let TOKENA_TOKENB_POOL_FEE=369

DATA = ethers.utils.defaultAbiCoder.encode(
    ["uint96","uint256","address[]","address[]","uint32[]","uint32[]"],
    [
        "999", 123,
        [WELLE,WNATIVE],
        [TOKENA, TOKENB],
        [NATIVE_POOL_FEE],
        [TOKENA_TOKENB_POOL_FEE]
    ]
)

console.log("DATA=",DATA)