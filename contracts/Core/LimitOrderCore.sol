// SPDX-License-Identifier: None
pragma solidity 0.8.18;

abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be _NOT_ENTERED
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }
}

import {IOps, ModuleData, Module} from "../interfaces/IOps.sol";
import {IERC20} from "../interfaces/IERC20.sol";
import {IHandler} from "../interfaces/IHandler.sol";
import {Ownable} from "./Ownable.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {ERC20Transfers} from '../library/ERC20Transfers.sol';

contract LimitOrderCore is Ownable, ReentrancyGuard {
    address public FEE_TOKEN;
    address immutable public WRAPPED_NATIVE;
    IOps public GELATO_OPS;
    address public NATIVE_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    struct VaultData{
        uint256 tokenBalance;
        uint256 feeTokenBalance;
        bytes32 taskId;
    }

    // Vault token balances
    mapping(address => VaultData) public vaultData;

    // _WRAPPED_NATIVE should be same as pool router WRAPPED_NATIVE
    constructor(address _FEE_TOKEN, address __owner, address _WRAPPED_NATIVE, address _GELATO_OPS) Ownable(__owner) ReentrancyGuard() {
        FEE_TOKEN=_FEE_TOKEN;
        WRAPPED_NATIVE = _WRAPPED_NATIVE;
        GELATO_OPS = IOps(_GELATO_OPS);
    }

    // Events
    event TaskCreated(
        address indexed vault,
        bytes32 indexed taskId,
        uint256 amountFeeToken,
        uint256 amountTokenA,
        address handler,
        bytes data,
        bool isNative
    );

    event OrderExecuted(
        address indexed vault,
        uint256 indexed bought,
        uint256 feePaid
    );

    event OrderCancelledAndVaultWithdrawn(
        address indexed vault
    );

    event MoreFeeTokenFunded(
        address indexed vault,
        uint256 indexed amount
    );

    /**
     * @dev Prevent users to send Ether directly to this contract
     */
    receive() external payable {
        require(
            msg.sender != tx.origin,
            "PineCore#receive: NO_SEND_ETH_PLEASE"
        );
    }

    function changeFeeToken(address _newFeeTokenAddress) onlyOwner external {
        // todo check is event required
        FEE_TOKEN=_newFeeTokenAddress;
    }

    function changeGelatoOps(IOps _newGelatoOps) onlyOwner external {
        GELATO_OPS=_newGelatoOps;
    }

    /**
     * @notice Get the vault's address of a token to token/ETH order
     * @param _handler - Address of the handler to use for the order execution
     * @param _inputToken - Address of the input token
     * @param _owner - Address of the order's owner
     * @param _swapData - Bytes of the order's data
     * @return address - The address of the vault
     */
    function vaultOfOrder(
        IHandler _handler,
        address _inputToken,
        address feeToken,
        address _owner,
        bytes memory _swapData
    ) public view returns (address) {
        return getVault(keyOf(_handler, _inputToken, feeToken, _owner, _swapData));
    }

    /**
     * @notice Check whether an order exists or not
     * @dev Check the balance of the order
     * @param _handler - Address of the handler to use for the order execution
     * @param _inputToken - Address of the input token
     * @param _owner - Address of the order's owner
     * @param _swapData - Bytes of the order's data
     * @return bool - whether the order exists or not
     */
    function existOrder(
        IHandler _handler,
        address _inputToken,
        address feeToken,
        address payable _owner,
        bytes calldata _swapData
    ) external view returns (bool) {
        address vault = vaultOfOrder(
            _handler,
            _inputToken,
            feeToken,
            _owner,
            _swapData
        );

        (uint256 tokenBalance, uint256 feeTokenBalance) = (vaultData[vault].tokenBalance, vaultData[vault].feeTokenBalance);

        return tokenBalance > 0 && feeTokenBalance > 0;
    }

    /**
     * @notice Check whether a limit order can be executed or not
     * @param _handler - Address of the handler to use for the order execution
     * @param _inputToken - Address of the input token
     * @param _owner - Address of the order's owner
     * @param _swapData - Bytes of the order's data
     * @return canExec - whether the order can be executed or not
     * @return execData - function and params to execute
     */
    function canExecuteLimitOrder(
        IHandler _handler,
        address _inputToken,
        address feeToken,
        address payable _owner,
        bytes calldata _swapData
    ) external view returns (bool canExec, bytes memory execData) {

        address vault = vaultOfOrder(
            _handler,
            _inputToken,
            feeToken,
            _owner,
            _swapData
        );

        // Check balance amount in vault
        canExec = _handler.canExecuteLimitOrder(
            vaultData[vault].feeTokenBalance,
            vaultData[vault].tokenBalance,
            _swapData
        );

        execData = abi.encodeWithSelector(this.executeLimitOrder.selector, _handler, _inputToken, feeToken, _owner, _swapData);
    }

    /**
     * @notice Get the order's key
     * @param _handler - Address of the handler to use for the order execution
     * @param _inputToken - Address of the input token
     * @param _owner - Address of the order's owner
     * @param _swapData - Bytes of the order's data
     * @return bytes32 - order's key
     */
    function keyOf(
        IHandler _handler,
        address _inputToken,
        address feeToken,
        address _owner,
        bytes memory _swapData
    ) public pure returns (bytes32) {
        return
        keccak256(
            abi.encode(_handler, _inputToken, feeToken, _owner, _swapData)
        );
    }

    function getVault(bytes32 _key) internal view returns (address) {
        return
        address(uint160(uint256(
                keccak256(
                    abi.encodePacked(
                        bytes1(0xff),
                        address(this),
                        _key
                    )
                )
            )
            )
        );
    }

    /**
     * @notice User deposits tokens
     * @param _amountFeeToken - Amount of fee token to deposit
     * @param _amountTokenA - Amount of tokenA to deposit
     * @param _handler - Address of the handler to use for the order execution
     * @param _swapData - Bytes of the order's data
     * @param isNativeToken - Is token passed as native, in case its not ERC20
     */
    function depositTokensAndCreateTask(
        uint256 _amountFeeToken,
        uint256 _amountTokenA,
        IHandler _handler,
        bool isNativeToken,
        bytes calldata _swapData
    ) public payable nonReentrant {

        address owner = msg.sender;
        address feeToken = address(bytes20(_swapData[108:128]));
        address tokenA = address(bytes20(_swapData[172:192]));
        address vaultToken;

        require(FEE_TOKEN == feeToken, "Fee token in pathNative swap doesnt match");

        bool isNative = (tokenA == WRAPPED_NATIVE && isNativeToken);
        if(isNative){
            vaultToken = NATIVE_ADDRESS;
        } else {
            vaultToken = tokenA;
        }

        bytes memory resolverData = abi.encode(
            address(this),
            abi.encodeWithSelector(
                    this.canExecuteLimitOrder.selector,
                        _handler,
                        vaultToken,
                        FEE_TOKEN,
                        owner,
                        _swapData
                )
        );

        Module[] memory modules = new Module[](3);
        modules[0] = (Module.RESOLVER);
        modules[1] = (Module.PROXY);
        modules[2] = (Module.SINGLE_EXEC);

        bytes[] memory moduleData = new bytes[](3);
        moduleData[0] = resolverData;
        moduleData[1] = hex"";
        moduleData[2] = hex"";

        ModuleData memory moduleDataGelato = ModuleData(modules,moduleData);

        // create gelato task
        bytes32 taskId = GELATO_OPS.createTask(address(this), abi.encodeWithSelector(this.executeLimitOrder.selector), moduleDataGelato, NATIVE_ADDRESS);

        address vault = vaultOfOrder(
            _handler,
            vaultToken,
            FEE_TOKEN,
            owner,
            _swapData
        );

        vaultData[vault] = VaultData(_amountTokenA, _amountFeeToken, taskId);

        uint256 requiredNative = 0;

        if(isNative){
            requiredNative += _amountTokenA;
        } else {
            ERC20Transfers.transferFromERC20Token(owner,address(this),tokenA,_amountTokenA);
        }

        // deposit FeeToken, assuming fee token is always ERC20 not native
        if (feeToken == NATIVE_ADDRESS) {
            requiredNative += _amountFeeToken;
        } else {
            // transfer fee token
            ERC20Transfers.transferFromERC20Token(owner,address(this),feeToken,_amountFeeToken);
        }

        // Check if correct amount of native token is sent
        require(msg.value == requiredNative, "Incorrect native token amount sent");

        emit TaskCreated(
            vault,
            taskId,
            _amountFeeToken,
            _amountTokenA,
            address(_handler),
            _swapData,
            isNativeToken
        );
    }


    /**
     * @notice Executes an order
     * @dev The sender should use the _secret to sign its own address
     * to prevent front-runnings
     * @param _handler - Address of the handler to use for the order execution
     * @param _inputToken - Address of the input token
     * @param _owner - Address of the order's owner
     * @param _swapData - Bytes of the order's data
     */
    function executeLimitOrder(
        IHandler _handler,
        address _inputToken,
        address feeToken,
        address payable _owner,
        bytes calldata _swapData
    ) public virtual {

        address vault = vaultOfOrder(
            _handler,
            _inputToken,
            feeToken,
            _owner,
            _swapData
        );

        (uint256 amountTokenA, uint256 amountFeeToken) = (vaultData[vault].tokenBalance, vaultData[vault].feeTokenBalance);
        // reset vault token and fee token balances
        delete vaultData[vault];

        // send tokens to handler
        transferToken(_inputToken,amountTokenA,payable(_handler),true);
        transferToken(feeToken,amountFeeToken,payable(_handler),false);

        require(
            amountTokenA > 0 && amountFeeToken > 0,
            "Core#executeLimitOrder: INVALID_ORDER"
        );

        (uint256 bought, uint256 feePaid) = _handler.executeLimitOrder(
            amountFeeToken,
            amountTokenA,
            _swapData
        );

        emit OrderExecuted(
            vault,
            bought,
            feePaid
        );
    }

    function cancelTaskAndWithdrawTokens(
        IHandler _handler,
        address feeToken,
        address vaultToken,
        bytes calldata swapData
    ) external {
        address vault = vaultOfOrder(
            _handler,
            vaultToken,
            feeToken,
            msg.sender,
            swapData
        );

        (uint256 tokenBalance, uint256 feeTokenBalance, bytes32 taskId) = (vaultData[vault].tokenBalance, vaultData[vault].feeTokenBalance, vaultData[vault].taskId);
        delete vaultData[vault];

        // cancel task associated with vault
        GELATO_OPS.cancelTask(taskId);

        transferToken(vaultToken,tokenBalance,payable(msg.sender),false);
        transferToken(feeToken,feeTokenBalance,payable(msg.sender),false);

        emit OrderCancelledAndVaultWithdrawn(
            vault
        );
    }

    function transferToken(address token, uint256 amountToken, address payable to, bool needWrap) internal {
        if(token == NATIVE_ADDRESS){
            if (needWrap){
                // wrap the native token and send to handler
                IWETH(WRAPPED_NATIVE).deposit{value: amountToken}();
//                IWETH(WRAPPED_NATIVE).transfer(to,amountToken);
                ERC20Transfers.transferERC20Token(to,WRAPPED_NATIVE,amountToken);
            } else {
                // send native
                ERC20Transfers.safeTransferETH(to,amountToken);
            }
        } else {
            // transfer the erc20 fee token
            ERC20Transfers.transferERC20Token(to,token,amountToken);
        }
    }

    function addMoreFeeTokens(
        IHandler _handler,
        address feeToken,
        address vaultToken,
        bytes memory swapData,
        uint256 amount
    ) external payable {
        // vault
        address vault = vaultOfOrder(
            _handler,
            vaultToken,
            feeToken,
            msg.sender,
            swapData
        );

        require(vaultData[vault].feeTokenBalance > 0, "trying to add to non-existent order");

        uint256 requiredNative = 0;

        vaultData[vault].feeTokenBalance += amount;
        if (feeToken != NATIVE_ADDRESS) {
            ERC20Transfers.transferFromERC20Token(msg.sender,address(this),feeToken,amount);
        } else {
            requiredNative = amount;
        }

        // Check if correct amount of native token is sent
        require(msg.value == requiredNative, "Incorrect fee native token amount sent");

        emit MoreFeeTokenFunded(vault, amount);
    }
}


