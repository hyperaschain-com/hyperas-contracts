// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract UUPSUpgradeableCustom is UUPSUpgradeable, OwnableUpgradeable {

    // Structure for upgrade requests
    struct UpgradeRequest {
        address newImplementation;
        uint256 activationTime;
        bool executed;
        bool canceled;
        uint256 approvalCount;
    }
    uint256 private _version; // Current version of the contract

    UpgradeRequest public pendingUpgrade; // Pending upgrade request
    mapping(address => bool) public upgradeApprovals;// Mapping approvals from authorized

    // Addresses of the authorized signers
    address public chiefTechnologyOfficer;
    address public financeDepartment;
    address public chairman;

    uint256 public constant UPGRADE_DELAY = 3 days; // 3 days delay for upgrade
    bool private _upgrading; // Flag to control upgrade process

    // Event list
    event UpgradeScheduled(address indexed newImplementation, uint256 activationTime);
    event UpgradeCanceled(address indexed newImplementation);
    event Upgraded(address indexed newImplementation);
    event UpgradeApproved(address indexed approver, address indexed newImplementation);

    // error list
    error InvalidImplementation();
    error UpgradeAlreadyPending();
    error NotAuthorized();
    error UpgradeNotScheduled();
    error UpgradeCanceled();
    error AlreadyApproved();
    error UpgradeNotAuthorized();
    error UpgradeNotExecuted();
    error CannotCancelAfterActivationTime();
    error ActivationTimeNotReached();
    error UpgradeAlreadyExecuted();
    error MinimumApprovalsNotReached();


    // Initializer function
    function __UUPSUpgradeableCustom_init(
        address _chiefTechnologyOfficer,
        address _financeDepartment,
        address _chairman
    ) internal initializer {
        __Ownable_init(_msgSender());
        __UUPSUpgradeable_init();
        _version = 1;
        chiefTechnologyOfficer = _chiefTechnologyOfficer;
        financeDepartment = _financeDepartment;
        chairman = _chairman;
    }

    /**
     * @dev Propose an upgrade to the contract
     * @param newImplementation Address of the new implementation
     */
    function proposeUpgrade(address newImplementation) public onlyOwner {
        // Can not propose an upgrade to the zero address
        if (newImplementation == address(0)) {
            revert InvalidImplementation();
        }
        // Can not propose an upgrade if there is already a pending upgrade
        if (pendingUpgrade.newImplementation != address(0)) {
            revert UpgradeAlreadyPending();
        }
        // Schedule the upgrade
        pendingUpgrade = UpgradeRequest({
            newImplementation: newImplementation,
            activationTime: block.timestamp + UPGRADE_DELAY,
            executed: false,
            canceled: false,
            approvalCount: 0
        });
        // Reset all the approvals
        upgradeApprovals[chiefTechnologyOfficer] = false;
        upgradeApprovals[financeDepartment] = false;
        upgradeApprovals[chairman] = false;

        emit UpgradeScheduled(newImplementation, pendingUpgrade.activationTime);
    }

    /**
     * @dev Approve the upgrade request
     */
    function approveUpgrade() public {
        if (msg.sender != chiefTechnologyOfficer && msg.sender != financeDepartment && msg.sender != chairman) {
            revert NotAuthorized();
        }
        if (pendingUpgrade.newImplementation == address(0)) {
            revert UpgradeNotScheduled();
        }
        if (pendingUpgrade.canceled) {
            revert UpgradeCanceled();
        }
        if (upgradeApprovals[msg.sender]) {
            revert AlreadyApproved();
        }
        upgradeApprovals[msg.sender] = true;
        pendingUpgrade.approvalCount += 1;
        emit UpgradeApproved(msg.sender, pendingUpgrade.newImplementation);
    }

    /**
     * @dev Cancel the upgrade request
     */
    function cancelUpgrade() public {
        // Only authorized signers can cancel the upgrade
        if (msg.sender != chiefTechnologyOfficer && msg.sender != financeDepartment && msg.sender != chairman && msg.sender != owner()) {
            revert NotAuthorized();
        }
        if (pendingUpgrade.newImplementation == address(0)) {
            revert UpgradeNotScheduled();
        }
        if (pendingUpgrade.canceled) {
            revert UpgradeCanceled();
        }
        if (block.timestamp >= pendingUpgrade.activationTime) {
            revert CannotCancelAfterActivationTime();
        }
        // Mark the upgrade as canceled
        pendingUpgrade.canceled = true;

        // Reset the pending upgrade and approvals
        delete pendingUpgrade;
        upgradeApprovals[chiefTechnologyOfficer] = false;
        upgradeApprovals[financeDepartment] = false;
        upgradeApprovals[chairman] = false;
        emit UpgradeCanceled(pendingUpgrade.newImplementation);
    }

    /**
     * @dev Execute the upgrade request
     */
    function executeUpgrade() public {
        if (pendingUpgrade.newImplementation == address(0)) {
            revert UpgradeNotScheduled();
        }
        if (pendingUpgrade.canceled) {
            revert UpgradeCanceled();
        }
        if (block.timestamp < pendingUpgrade.activationTime) {
            revert ActivationTimeNotReached();
        }
        if (pendingUpgrade.executed) {
            revert UpgradeAlreadyExecuted();
        }
        // Check if the minimum approvals are reached (min 2)
        if (pendingUpgrade.approvalCount < 2) {
            revert  MinimumApprovalsNotReached();
        }
        pendingUpgrade.executed = true;  // Mark the upgrade as executed
        _upgrading = true; // Set the upgrading flag to true
        // Upgrade the contract
        _upgradeToAndCallUUPS(pendingUpgrade.newImplementation, new bytes(0), false);
        _upgrading = false; // Reset the upgrading flag
        // Increment the version
        _version += 1;

        // Reset the pending upgrade and approvals
        delete pendingUpgrade;
        upgradeApprovals[chiefTechnologyOfficer] = false;
        upgradeApprovals[financeDepartment] = false;
        upgradeApprovals[chairman] = false;

        emit Upgraded(pendingUpgrade.newImplementation);
    }

    // Authorize upgrade (called during the upgrade process)
    function _authorizeUpgrade(address newImplementation) internal override {
        if (!_upgrading) {
            revert UpgradeNotAuthorized();
        }
    }

    // Get the current version
    function getVersion() public view returns (uint256) {
        return _version;
    }
}
