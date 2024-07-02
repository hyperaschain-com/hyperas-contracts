// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";


/**
 * @title RewardPool
 * @dev This contract is used to distribute rewards
 */
contract RewardPool is Ownable, Pausable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;
    // receivers list with EnumerableSet
    EnumerableSet.AddressSet private receivers;
    mapping(address => uint256) public receiverRewards; // reward of each receiver
    uint256 public totalRewards; // total rewards

    // rule for each address to receive rewards
    uint256 private minDistributionAmount;
    uint256 private maxDistributionAmount;
    uint256 private minDistributionInterval;
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

    constructor() Ownable(msg.sender){
        // Initial state variables
        minDistributionAmount = 1000 * 10 ** 18; // 1000 HYRA
        maxDistributionAmount = 100_000 * 10 ** 18; // 100,000 HYRA
        minDistributionInterval = 1 days; // 1 day
    }

    /**
     * @dev distribute rewards to one address
     * @param _receiver The address to transfer rewards
     * @param _reward The reward to transfer
     */
    function distributeReward(address _receiver, uint256 _reward) external onlyOwner nonReentrant whenNotPaused {
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
    function setDistributionAmountRange(uint256 _minDistributionAmount, uint256 _maxDistributionAmount) external onlyOwner {
        minDistributionAmount = _minDistributionAmount;
        maxDistributionAmount = _maxDistributionAmount;
        emit DistributionAmountRangeChanged(_minDistributionAmount, _maxDistributionAmount);
    }

    /**
     * @dev change min distribution Interval
     * @param _minDistributionInterval The minimum interval of distribution
     */
    function setMinDistributionInterval(uint256 _minDistributionInterval) external onlyOwner {
        minDistributionInterval = _minDistributionInterval;
        emit DistributionIntervalChanged(_minDistributionInterval);
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner{
        _pause();
    }
    /**
    * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Receive HYRA
     */
    receive() external payable {}

}
