// SPDX-License-Identifier: None
pragma solidity ^0.8.18;
import {IERC20} from "../interfaces/IERC20.sol";
import {IOps} from "../interfaces/IOps.sol";
import "../interfaces/IHandler.sol";
import "../Core/Ownable.sol";
import {LocalRouter} from "./LocalRouter.sol";
import {ERC20Transfers} from '../library/ERC20Transfers.sol';

contract HandlerV1 is IHandler,Ownable,LocalRouter {
    IOps immutable gelatoOps;
    address immutable WRAPPED_NATIVE;

    // _WRAPPED_NATIVE should be same as pool router WRAPPED_NATIVE
    constructor(address _ops, address factory, address __owner, address _WRAPPED_NATIVE) Ownable(__owner) LocalRouter(factory,_WRAPPED_NATIVE) {
        gelatoOps = IOps(_ops);
        WRAPPED_NATIVE=_WRAPPED_NATIVE;
    }

    // dont send tokens directly
    receive() external payable {
        require(
            msg.sender != tx.origin,
            "dont send native tokens directly"
        );
    }

    // Need to be invoked in case when Gelato changes their native token address , very unlikely though
    function updateNativeTokenAddress(address newNativeTokenAddress) external onlyOwner {
        NATIVE_TOKEN = newNativeTokenAddress;
    }

    // Transfer native token
    function _transfer(uint256 _fee, address _feeToken, address payable to) internal {
        if (_feeToken == NATIVE_TOKEN) {
            ERC20Transfers.safeTransferETH(to,_fee);
        } else {
            ERC20Transfers.transferERC20Token(address(to),_feeToken,_fee);
        }
    }

    // Get transaction fee and feeToken from GelatoOps for the transaction execution
    function _getFeeDetails()
    internal
    view
    returns (uint256 fee, address feeToken)
    {
        (fee, feeToken) = gelatoOps.getFeeDetails();
    }

    // Checker for limit order
    function canExecuteLimitOrder(
        uint256 amountFeeToken,
        uint256 amountTokenA,
        bytes calldata swapData
    ) external view returns (bool) {

        address[2] memory pathNativeSwap;
        address[2] memory pathTokenSwap;
        uint32 feeNativeSwap;
        uint32 feeTokenSwap;
        uint256 minReturn;

        {
            // Decode data
            (
            ,
            uint96 deadline,
            uint256 minReturnDecoded,
            address pathNativeSwapTokenA,
            address pathNativeSwapTokenB,
            address pathTokenSwapTokenA,
            address pathTokenSwapTokenB,
            uint32 nativeSwapFee,
            uint32 tokenSwapFee
            ) = abi.decode(
                swapData,
                    (address,uint96, uint256, address,address,address,address, uint32,uint32)
            );

            // Check order validity
            require(block.timestamp < deadline,"deadline passed");

            pathNativeSwap[0] = pathNativeSwapTokenA;
            pathNativeSwap[1] = pathNativeSwapTokenB;
            pathTokenSwap[0] = pathTokenSwapTokenA;
            pathTokenSwap[1] = pathTokenSwapTokenB;
            feeNativeSwap = nativeSwapFee;
            feeTokenSwap = tokenSwapFee;
            minReturn=minReturnDecoded;
        }

        // Check if sufficient tokenB will be returned
        require(
            getAmountsOut(
                amountTokenA,
                pathTokenSwap,
                feeTokenSwap
            )[pathTokenSwap.length - 1] >= minReturn,
            "insufficient token B returned"
        );

        // Check if input FeeToken amount is sufficient to cover fees
        (uint256 FEES, ) = _getFeeDetails();

        if(pathNativeSwap[0] == NATIVE_TOKEN){
            require(amountFeeToken >= FEES, "insufficient NATIVE fees");
        }
        else{
            require(
                getAmountsOut(
                    amountFeeToken,
                    pathNativeSwap,
                    feeNativeSwap
                )[pathNativeSwap.length - 1] >= FEES,
                "insufficient NATIVE_TOKEN returned"
            );
        }

        return true;
    }

    // Executor for limit order
    function executeLimitOrder(
        uint256 amountFeeToken,
        uint256 amountTokenA,
        bytes calldata swapData
    ) external payable returns(uint256,uint256) {
        // Decode data
        (
        address _owner,
        uint96 deadline,
        uint256 minReturn,
        address pathNativeSwapTokenA,
        address pathNativeSwapTokenB,
        address pathTokenSwapTokenA,
        address pathTokenSwapTokenB,
        uint32 nativeSwapFee,
        uint32 tokenSwapFee
        ) = abi.decode(
            swapData,
            (address, uint96, uint256, address,address,address,address, uint32,uint32)
        );

        address[2] memory pathNativeSwap;
        pathNativeSwap[0] = pathNativeSwapTokenA;
        pathNativeSwap[1] = pathNativeSwapTokenB;
        address[2] memory pathTokenSwap;
        pathTokenSwap[0] = pathTokenSwapTokenA;
        uint32 feeNativeSwap = nativeSwapFee;
        uint32 feeTokenSwap = tokenSwapFee;

        uint256 bought;

        if (pathTokenSwapTokenB == NATIVE_TOKEN){
            pathTokenSwap[1] = WNative;
            // call swap tokenA to native
            bought = swapExactTokensForNative(
                amountTokenA,
                minReturn,
                pathTokenSwap,
                feeTokenSwap,
                _owner,
                deadline
            );
        } else {
            pathTokenSwap[1]= pathTokenSwapTokenB;
            // call swap tokenA to tokenB
            bought = swapExactTokensForTokens(
                amountTokenA,
                minReturn,
                pathTokenSwap,
                feeTokenSwap,
                _owner,
                deadline
            );
        }

        // calculate feeToken amount from native fee
        uint256[2] memory feeTokenAmountFromNativeFee;

        // get tx fee
        (uint256 FEES, address feeToken) = _getFeeDetails();

        if (pathNativeSwap[0] == NATIVE_TOKEN)
        {
            // send gelato fees directly
            ERC20Transfers.safeTransferETH(gelatoOps.gelato(),FEES);

            // transfer the remaining welle back to owner
            _transfer(amountFeeToken - FEES,pathNativeSwap[0],payable(_owner));

            return (bought,feeTokenAmountFromNativeFee[0]);
        }

        // swap and receive erc20 gelato tokens
        feeTokenAmountFromNativeFee = getAmountsIn(
            FEES,
            pathNativeSwap,
            feeNativeSwap
        );

        require(
            amountFeeToken >= feeTokenAmountFromNativeFee[0],
            "insufficient feeToken amount"
        );

        require(
            IERC20(pathNativeSwap[0]).balanceOf(address(this)) >=
            amountFeeToken,
            "insufficient balance of feeToken in handler"
        );

        // call swap tokenA to native token
        if (feeToken == NATIVE_TOKEN){
            require(pathNativeSwap[pathNativeSwap.length-1] == WRAPPED_NATIVE, "wrong fee native path");
            swapTokensForExactNative(
                FEES,
                feeTokenAmountFromNativeFee[0],
                pathNativeSwap,
                feeNativeSwap,
                gelatoOps.gelato(),
                deadline
            );
        } else {
            require(pathNativeSwap[pathNativeSwap.length-1] == feeToken, "wrong erc20 fee native path");
            swapTokensForExactTokens(
                FEES,
                feeTokenAmountFromNativeFee[0],
                pathNativeSwap,
                feeNativeSwap,
                gelatoOps.gelato(),
                deadline
            );
        }

        // transfer the remaining welle back to owner
        _transfer(amountFeeToken - feeTokenAmountFromNativeFee[0],pathNativeSwap[0],payable(_owner));

        return (bought,feeTokenAmountFromNativeFee[0]);
    }
}