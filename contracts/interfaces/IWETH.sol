// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IWETH{
    // Wrap ETH to WETH
    function deposit() external payable;
    function transfer(address dst, uint wad) external returns (bool);
}
