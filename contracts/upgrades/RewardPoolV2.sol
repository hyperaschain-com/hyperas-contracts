// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title RewardPoolV2
 * @dev This contract is used to distribute rewards
 */
contract RewardPoolV2 is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    // receivers list with EnumerableSet
    EnumerableSet.AddressSet private receivers;

    mapping(address => uint256) public receiverRewards; // reward of each receiver
    uint256 public totalRewards; // total rewards

    // rule for each address to receive rewards
    uint256 public minDistributionAmount;
    uint256 public maxDistributionAmount;
    uint256 public minDistributionInterval;
    mapping(address => uint256) public lastReceivedTime; // last received time of each receiver

    // error list
    error MismatchLength();
    error DistributionIntervalNotReached();
    error InsufficientContractBalance();
    error ZeroAddress();
    error TransferFailed();
    error DistributionAmountOutOfRange();

    // event list
    event TransferReward(address indexed _to, uint256 _amount);
    event DistributeReward(address _receivers, uint256 _rewards);
    event DistributionAmountRangeChanged(uint256 _minDistributionAmount, uint256 _maxDistributionAmount);
    event DistributionIntervalChanged(uint256 _minDistributionInterval);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract
     */
    function initialize() public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        // grant role
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setRoleAdmin(DISTRIBUTOR_ROLE, DEFAULT_ADMIN_ROLE);

        // Initializable state variables
        minDistributionAmount = 1000 * 10 ** 18; // 1000 HYRA
        maxDistributionAmount = 100_000 * 10 ** 18; // 100,000 HYRA
        minDistributionInterval = 1 days; // 1 day
    }

    /**
     * @dev distribute rewards to one address
     * @param _receiver The address to transfer rewards
     * @param _reward The reward to transfer
     */
    function distributeReward(address _receiver, uint256 _reward) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant whenNotPaused {
        _transferReward(_receiver, _reward);
        emit DistributeReward(_receiver, _reward);
    }


    /**
     * @dev private function to transfer reward to a specific address
     * @param _to The address to transfer reward
     * @param _amount The amount of reward to transfer
     */
    function _transferReward(address _to, uint256 _amount) private {
        // check rule for each receiver
        if(_to == address(0)) revert ZeroAddress();
        if(block.timestamp < minDistributionInterval + lastReceivedTime[_to]) revert DistributionIntervalNotReached();
        if(_amount < minDistributionAmount || _amount > maxDistributionAmount) revert DistributionAmountOutOfRange();
        if(address(this).balance < _amount) revert InsufficientContractBalance();

        // Effects
        lastReceivedTime[_to] = block.timestamp;
        receiverRewards[_to] += _amount;
        receivers.add(_to);

        // transfer reward to the receiver
        (bool success, ) = payable(_to).call{value: _amount}("");
        if(!success) revert TransferFailed();

        // Update total only after successful transfer
        totalRewards += _amount;

        // emit event
        emit TransferReward(_to, _amount);
    }

    /**
     * @dev change the amount range for each receiver
     * @param _minDistributionAmount The minimum amount of reward
     * @param _maxDistributionAmount The maximum amount of reward
     */
    function setDistributionAmountRange(uint256 _minDistributionAmount, uint256 _maxDistributionAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minDistributionAmount = _minDistributionAmount;
        maxDistributionAmount = _maxDistributionAmount;
        emit DistributionAmountRangeChanged(_minDistributionAmount, _maxDistributionAmount);
    }

    /**
     * @dev change min distribution Interval
     * @param _minDistributionInterval The minimum interval of distribution
     */
    function setMinDistributionInterval(uint256 _minDistributionInterval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minDistributionInterval = _minDistributionInterval;
        emit DistributionIntervalChanged(_minDistributionInterval);
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    /**
    * @dev Unpause the contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Receive HYRA
     */
    receive() external payable {}






}
