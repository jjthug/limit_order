// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './IRouter.sol';

interface IRouterV2 is IRouter {
    // Identical to removeLiquidityNative, but succeeds for tokens that take a fee on transfer.
    function removeLiquidityNativeSupportingFeeOnTransferTokens(
        address token,
        uint32 fee,
        uint liquidity,
        uint amountTokenMin,
        uint amountNativeMin,
        address to,
        uint deadline
    ) external returns (uint amountNative);
    // Identical to swapExactTokensForTokens, but succeeds for tokens that take a fee on transfer.
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        uint32[] calldata feePath,
        address to,
        uint deadline
    ) external;

    // Identical to swapExactNativeForTokens, but succeeds for tokens that take a fee on transfer.
    function swapExactNativeForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        uint32[] calldata feePath,
        address to,
        uint deadline
    ) external payable;

    // Identical to swapExactTokensForNative, but succeeds for tokens that take a fee on transfer.
    function swapExactTokensForNativeSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        uint32[] calldata feePath,
        address to,
        uint deadline
    ) external;
}