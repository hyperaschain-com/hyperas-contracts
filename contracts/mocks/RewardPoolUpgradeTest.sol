// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../upgradeable/UUPSUpgradeableCustom.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
/**
 * @title RewardPoolUpgradeTest
 * @dev This contract is used to distribute HYRA rewards
 */
contract RewardPoolUpgradeTest is UUPSUpgradeableCustom, AccessControlUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable  {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;
    // Roles
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE"); // owner role
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant DELIVER_ROLE = keccak256("DELIVER_ROLE");
    // address list
    address public signer; // sign a transaction
    address public manager; // manage contract
    address public verifier; // verify transaction
    address public deliver; // deliver reward

    EnumerableSet.AddressSet private receivers; // HYRA receivers
    // mapping isNonceUsed
    mapping(string => bool) public isNonceUsed; // save nonce for each request, nonce is string
    mapping(address => uint256) public totalRewardByAddress; // save total rewards by address
    uint256 public totalRewards; // total reward delivered

    // set limit
    uint256 public minPaymentAmount; // min payment amount for each transaction
    uint256 public maxPaymentAmount; // max payment amount for each transaction
    uint256 public maxDailyPaymentAmount; // max daily payment amount

    mapping(uint256 => mapping(uint256 => uint256)) public dailyPaymentAmount;
    mapping(address => bool) public isApproved; // withdraw needs to be approved
    mapping(address => mapping(string => bool)) public isUserBillVerified;

    // error list
    error InvalidNonce(string nonce);
    error InvalidUserBill();
    error InvalidSigner();
    error InvalidAmount(uint256 amount);
    error ExceedMaxPaymentAmount(uint256 amount);
    error BelowMinPaymentAmount(uint256 amount);
    error ExceedMaxDailyPaymentAmount(uint256 amount);
    error AddressNotApproved(address user);
    error InsufficientBalance(uint256 balance, uint256 amount);
    error UserBillNotApproved(address user, string nonce);
    error TransferFailed();

    // event list
    event Approved(address indexed user);
    event SuccessfulDelivery(address indexed user, uint256 amount, string nonce);
    event UserBillVerified(address indexed user, string nonce);
    event LimitChanged(uint256 minPaymentAmount, uint256 maxPaymentAmount);
    event DailyLimitChanged(uint256 dailyPaymentAmount);
    event WithdrawERC20(address indexed token, address indexed to, uint256 amount);
    event WithdrawETH(address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _managerAddress,
        address _signerAddress,
        address _verifierAddress,
        address _deliverAddress,
        address _chiefTechnologyOfficer,
        address _financeDepartment,
        address _chairman
    ) public initializer {
        // Initialize contract
        __UUPSUpgradeableCustom_init(_chiefTechnologyOfficer, _financeDepartment, _chairman);
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        // set limit
        minPaymentAmount = 10e18; // init min 10 HYRA for each transaction
        maxPaymentAmount = 1000e18; // init max 1000 HYRA for each transaction
        maxDailyPaymentAmount = 1000e18; // init max daily 1000 HYRA
        // set roles
        _grantRole(OWNER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, _managerAddress);
        _grantRole(VERIFIER_ROLE, _verifierAddress);
        _grantRole(DELIVER_ROLE, _deliverAddress);
        // set address
        manager = _managerAddress;
        verifier = _verifierAddress;
        signer = _signerAddress;
        deliver = _deliverAddress;
    }

    /*
     * @dev this function to deliver rewards to user
     * @param user address of user
     * @param uid user id
     * @param amount amount of HYRA rewards
     * @param nonce bill id
     * @param signature of signer for the transaction
     */
    function deliverRewards(
        address user,
        uint256 uid,
        uint256 amount,
        string memory nonce,
        bytes memory signature
    ) external nonReentrant whenNotPaused onlyRole(DELIVER_ROLE) {
        // check user bill
        if (!isUserBillVerified[user][nonce])
            revert UserBillNotApproved(user, nonce);
        // check payment amount
        if (amount < minPaymentAmount) revert BelowMinPaymentAmount(amount);
        if (amount > maxPaymentAmount) revert ExceedMaxPaymentAmount(amount);
        // check nonce
        if (isNonceUsed[nonce]) revert InvalidNonce(nonce);
        // check daily payment amount
        _dailyPaymentAmount(uid, amount);
        // check signature
        bytes32 message = keccak256(abi.encodePacked(user, amount, nonce));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", message)
        );
        address recoveredSigner = recoverSigner(ethSignedMessageHash, signature);
        if (recoveredSigner != signer) revert InvalidSigner();
        // done check nonce is used
        isNonceUsed[nonce] = true;
        // transfer HYRA rewards as native token
        (bool success, ) = payable(user).call{value: amount}("");
        if(!success) revert TransferFailed();
        totalRewardByAddress[user] += amount; // update claimed amount
        totalRewards += amount; // update total claimed amount
        receivers.add(user); // add user to receivers
        // emit event
        emit SuccessfulDelivery(user, amount, nonce);
    }

    /**
     * @dev verify user bill
     * @param user address of user
     * @param nonce bill id
     */
    function verifyUserBill(
        address user,
        string memory nonce
    ) public onlyRole(VERIFIER_ROLE) {
        isUserBillVerified[user][nonce] = true;
        emit UserBillVerified(user, nonce);
    }

    /**
     * @dev approve address to withdraw purpose
     * @param addr address to approve
     */
    function approveAddress(address addr) public onlyRole(OWNER_ROLE) {
        isApproved[addr] = true;
        emit Approved(addr);
    }

    /**
     * @dev recover signer from signature
     * @param message message to recover signer
     * @param signature signature of signer
     */
    function recoverSigner(
        bytes32 message,
        bytes memory signature
    ) public pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "Invalid signature 'v' value");
        return ecrecover(message, v, r, s);
    }

    /**
     * @dev check daily payment amount
     * @param uid user id
     * @param amount amount of HYRA rewards
     */
    function _dailyPaymentAmount(uint256 uid, uint256 amount) private {
        if (amount > maxDailyPaymentAmount)
            revert ExceedMaxDailyPaymentAmount(amount);
        uint256 currentDay = block.timestamp / 1 days;
        if (
            dailyPaymentAmount[uid][currentDay] + amount >
            maxDailyPaymentAmount
        ) revert ExceedMaxDailyPaymentAmount(amount);
        dailyPaymentAmount[uid][currentDay] += amount;
    }

    /**
     * @dev set limit again
     * @param _minPaymentAmount min payment amount
     * @param _maxPaymentAmount max payment amount
     */
    function setLimit(
        uint256 _minPaymentAmount,
        uint256 _maxPaymentAmount
    ) public onlyRole(OWNER_ROLE) {
        minPaymentAmount = _minPaymentAmount;
        maxPaymentAmount = _maxPaymentAmount;
        emit LimitChanged(_minPaymentAmount, _maxPaymentAmount);
    }

    /**
     * @dev set daily payment amount
     * @param _maxDailyPaymentAmount max daily payment amount
     */
    function setDailyPaymentAmount(
        uint256 _maxDailyPaymentAmount
    ) public onlyRole(OWNER_ROLE) {
        maxDailyPaymentAmount = _maxDailyPaymentAmount;
        emit DailyLimitChanged(_maxDailyPaymentAmount);
    }

    /**
     * @dev get address of receivers
     * @return number of receivers
     */
    function numberOfReceivers() public view returns (uint256) {
        return receivers.length();
    }

    /**
     * @dev get receivers
     * @return list of receivers
     */
    function getReceivers() public view returns (address[] memory) {
        return receivers.values();
    }

    /**
     * @dev get receiver with index
     * @param index index of receiver
     * @return address of receiver
     */
    function getReceiver(uint256 index) public view returns (address) {
        return receivers.at(index);
    }

    /**
     * @dev pause contract
     */
    function pause() public onlyRole(OWNER_ROLE) {
        _pause();
    }

    /**
     * @dev unpause contract
     */
    function unpause() public onlyRole(OWNER_ROLE) {
        _unpause();
    }

    /**
     * @dev withdraw erc20
     * @param token address of token
     * @param amount amount of token
     */
    function withdrawErc20(
        address token,
        uint256 amount
    ) public onlyRole(MANAGER_ROLE) {
        if (amount == 0) revert InvalidAmount(amount);
        address sender = _msgSender();
        if (!isApproved[sender]) revert AddressNotApproved(sender);
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        if (amount > tokenBalance)
            revert InsufficientBalance(tokenBalance, amount);
        IERC20(token).safeTransfer(sender, amount);
        isApproved[sender] = false;
        emit WithdrawERC20(token, sender, amount);
    }

    /**
     * @dev withdraw native
     * @param amount of native
     */
    function withdrawNative(uint256 amount) public onlyRole(MANAGER_ROLE) {
        if (amount == 0) revert InvalidAmount(amount);
        address sender = _msgSender();
        if (!isApproved[sender]) revert AddressNotApproved(sender);
        uint256 balance = address(this).balance;
        if (amount > balance) revert InsufficientBalance(balance, amount);
        payable(sender).transfer(amount);
        isApproved[sender] = false;
        emit WithdrawETH(sender, amount);
    }

    // receive eth
    receive() external payable {
        if (msg.value == 0) revert InvalidAmount(msg.value);
    }

    fallback() external payable {
        revert("Function does not exist");
    }
    // add new function for upgradeable contract
    function getTestNumber() public pure returns (uint256) {
        return 1234;
    }
}
