// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IHandler {

    /// @notice receive ETH
    receive() external payable;

    /**
     * @notice Executes an order
     * @param _inputAmountFeeToken - uint256 of the input FeeToken amount (order amount)
     * @param _inputAmountTokenA - uint256 of the input token amount (order amount)
     * @param _data - Bytes of the order's data
     * @return bought - amount of output token bought
     */
    function executeLimitOrder(
        uint256 _inputAmountFeeToken,
        uint256 _inputAmountTokenA,
        bytes calldata _data
    ) external payable returns (uint256,uint256);

    /**
     * @notice Check whether an order can be executed or not
     * @param amountFeeToken - uint256 of the input FeeToken token amount (order amount)
     * @param amountTokenA - uint256 of the input token token amount (order amount)
     * @param swapData - Bytes of the order's data
     * @return bool - whether the order can be executed or not
     */
    function canExecuteLimitOrder(
        uint256 amountFeeToken,
        uint256 amountTokenA,
        bytes calldata swapData
    ) external view returns (bool);
}
