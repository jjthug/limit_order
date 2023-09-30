// SPDX-License-Identifier: None
pragma solidity ^0.8.17;

interface ICore {
    function depositTokens(
        uint256 _amountWelle,
        uint256 _amountTokenA,
        address _module,
        address _tokenA,
        address payable _owner,
        address _witness,
        bytes calldata _data
    ) external;

    function withdrawTokens(
        address _module,
        address _tokenA,
        address payable _owner,
        address _witness,
        bytes calldata _data
    ) external;
}
