# Limit Order Gelato

Limit Order automated by Gelato Network.


## Limit Order Flow

![Limit Order Flow](diag.png?raw=true "Limit Order Flow")



## Install dependencies
```shell
npm i
```

## Add environment variables

Follow .env.example file and create .env file. 
Use the default values in .env.example in .env


## Run test

The test must be run only on mumbai testnet

```angular2html
npx hardhat test
```


## Deployment

Deploying core

```angular2html
npx hardhat run script/deploy_core.js
```

Deploying handler

```angular2html
npx hardhat run script/deploy_handler.js
```


## Verify contract

Create standard-json-input (currently only for mac)
For other OS check https://github.com/hjubb/solt
```angular2html
 ./solt-verify/solt-mac write ./contracts/Core/LimitOrderCore.sol --runs 99999 --npm
```
add ***"viaIR" : true*** under settings in the json file
Upload this json to the block explorer of the network

## Gelato Supported Networks

1. Arbitrum
2. Avalanche
3. BNB Chain (formerly Binance Smart Chain)
4. Cronos
5. Ethereum Mainnet
6. Fantom
7. Gnosis Chain (formerly xDAI)
8. Moonbeam
9. Moonriver
10. Optimism
11. Polygon

The following staging networks are supported:
1. Goerli
2. Mumbai
3. Arbitrum Goerli
4. Optimism Goerli
5. Base Goerli
