require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-etherscan");
require('solidity-coverage')

// Process Env Variables
require('dotenv').config()

const { MUMBAI, PRIVATE_KEY, PRIVATE_KEY2, API_KEY, MUMBAI_API_KEY } = process.env;

module.exports = {
  solidity: {
    version:"0.8.18",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 99999
      }
    }
  },
  mocha: {
    timeout: 300000
  },
  defaultNetwork: "mumbai",
  networks: {
    hardhat: {
      // gasPrice : 500 * 1000000000
    },
    mumbai:{
      url: MUMBAI,
      accounts: [PRIVATE_KEY, PRIVATE_KEY2],
      chainId:80001
    }
  },
  etherscan: {
    apiKey: {
      goerli: API_KEY,
      polygonMumbai: MUMBAI_API_KEY
    }
  }
};