// SPDX-License-Identifier: None
pragma solidity ^0.8.18;
import {DEXLibrary} from "./libs/DEXLibraryContract.sol";
import "./interfaces/IERC20Pair.sol";
import "./interfaces/IWETH.sol";
import {IRouter} from "./interfaces/IRouter.sol";
import "./interfaces/IPoolFactory.sol";
import {IERC20} from "../interfaces/IERC20.sol";
import {ERC20Transfers} from '../library/ERC20Transfers.sol';

contract LocalRouter is DEXLibrary{

    address public immutable factory;
    address public immutable WNative;
    address public NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    constructor(address _factory, address _WNative) {
        factory = _factory;
        WNative = _WNative;
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "LocalRouter: EXPIRED");
        _;
    }

    // **** SWAP (supporting fee-on-transfer tokens) ****
    // requires the initial amount to have already been sent to the first pair
    function _swapSupportingFeeOnTransferTokens(
        address[2] memory path,
        uint32 feePath,
        address _to
    ) internal virtual {
        (address input, address output, uint32 fees) = (
            path[0],
            path[1],
            feePath
        );
        (address token0, ) = sortTokens(input, output);
        IERC20Pair pair = IERC20Pair(
            pairFor(factory, input, output, fees)
        );
        uint256 amountInput;
        uint256 amountOutput;
        {
            // scope to avoid stack too deep errors
            (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
            (uint256 reserveInput, uint256 reserveOutput) = input == token0
                ? (reserve0, reserve1)
                : (reserve1, reserve0);
            amountInput =
            IERC20(input).balanceOf(address(pair)) -
            reserveInput;
            amountOutput = getAmountOut(
                amountInput,
                reserveInput,
                reserveOutput,
                fees
            );
        }
        {
            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOutput)
                : (amountOutput, uint256(0));
            pair.swap(amount0Out, amount1Out, _to, new bytes(0));
        }
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[2] memory path,
        uint32 feePath,
        address to,
        uint256 deadline
    )
    internal
    ensure(deadline)
    returns (uint256[2] memory amounts)
    {
        amounts = getAmountsIn(factory, amountOut, path, feePath);
        require(amounts[0] <= amountInMax, "Router: EXCESSIVE_INPUT_AMOUNT");
        transferFrom(
            path[0],
            pairFor(factory, path[0], path[1], feePath),
            amounts[0]
        );
        _swap(amounts, path, feePath, to);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[2] memory path,
        uint32 feePath,
        address to,
        uint256 deadline
    )
    internal
    virtual
    ensure(deadline)
    returns(uint256 tokenBReceived)
    {
        transferFrom(
            path[0],
            pairFor(factory, path[0], path[1], feePath),
            amountIn
        );
        uint256 balanceBefore = IERC20(path[1]).balanceOf(to); //?
        _swapSupportingFeeOnTransferTokens(path, feePath, to);
        require(
            IERC20(path[1]).balanceOf(to) - (balanceBefore) >=
            amountOutMin,
            "RouterV2: INSUFFICIENT_OUTPUT_AMOUNT"
        );

        return IERC20(path[1]).balanceOf(to) - (balanceBefore);
    }

    function swapTokensForExactNative(
        uint256 amountOut,
        uint256 amountInMax,
        address[2] memory path,
        uint32  feePath,
        address to,
        uint256 deadline
    )
    internal
    virtual
    ensure(deadline)
    returns (uint256[2] memory amounts)
    {
        require(path[path.length - 1] == WNative, "Router: INVALID_PATH");
        amounts = getAmountsIn(factory, amountOut, path, feePath);
        require(amounts[0] <= amountInMax, "Router: EXCESSIVE_INPUT_AMOUNT");
        transferFrom(
            path[0],
            pairFor(factory, path[0], path[1], feePath),
            amounts[0]
        );
        _swap(amounts, path, feePath, address(this));
        IWETH(WNative).withdraw(amounts[amounts.length - 1]);
        safeTransferNative(to, amounts[amounts.length - 1]);
    }

    function _swap(
        uint256[2] memory amounts,
        address[2] memory path,
        uint32 feePath,
        address _to
    ) internal virtual {
        (address input, address output) = (path[0], path[1]);
        (address token0,) = sortTokens(input, output);
        uint256 amountOut = amounts[1];
        (uint256 amount0Out, uint256 amount1Out) = input == token0
            ? (uint256(0), amountOut)
            : (amountOut, uint256(0));
        IERC20Pair(pairFor(factory, input, output, feePath))
        .swap(amount0Out, amount1Out, _to, new bytes(0));
    }

    function transferFrom(
        address token,
        address to,
        uint256 value
    ) internal {
        ERC20Transfers.transferERC20Token(to,token,value);
    }

    function safeTransferNative(address to, uint256 value) internal {
        ERC20Transfers.safeTransferETH(to,value);
    }

    function getAmountsOut(
        uint256 amountIn,
        address[2] memory path,
        uint32 feePath
    ) internal view returns (uint256[] memory amounts) {
        if (path[1] == NATIVE_TOKEN){
            path[1] = WNative;
        }

        address poolAddress = IPoolFactory(factory).getPair(
            path[0],
            path[1],
            feePath
        );
        if (poolAddress == address(0)) {
            amounts = new uint256[](2);
            amounts[0] = 0;
            amounts[1] = 0;
            return amounts;
        }
        return getAmountsOut(factory, amountIn, path, feePath);
    }

    function getAmountsIn(
        uint256 amountOut,
        address[2] memory path,
        uint32 feePath
    ) internal view returns (uint256[2] memory amounts) {
        address poolAddress = IPoolFactory(factory).getPair(
            path[0],
            path[1],
            feePath
        );
        if (poolAddress == address(0)) {
            amounts[0] = 0;
            amounts[1] = 0;
            return amounts;
        }
        return getAmountsIn(factory, amountOut, path, feePath);
    }

    function swapExactTokensForNative(
        uint256 amountIn,
        uint256 amountOutMin,
        address[2] memory path,
        uint32 feePath,
        address to,
        uint256 deadline
    ) internal ensure(deadline) returns(uint256) {
        require(
            path[1] == WNative,
            "RouterV2: INVALID_PATH"
        );

        ERC20Transfers.transferERC20Token(
            DEXLibrary.pairFor(factory, path[0], path[1], feePath),
            path[0],
            amountIn
        );

        _swapSupportingFeeOnTransferTokens(path, feePath, address(this));
        uint256 amountOut = IERC20(WNative).balanceOf(address(this));
        require(
            amountOut >= amountOutMin,
            "RouterV2: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        IWETH(WNative).withdraw(amountOut);
        safeTransferNative(to, amountOut);

        return amountOut;
    }
}