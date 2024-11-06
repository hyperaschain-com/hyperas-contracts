// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract UUPSUpgradeableCustom is UUPSUpgradeable, OwnableUpgradeable {

    // Structure for upgrade requests
    struct UpgradeRequest {
        address newImplementation;
        uint256 activationTime;
        uint256 approvalCount;
    }

    uint256 private _version; // Current version of the contract

    UpgradeRequest public pendingUpgrade; // Pending upgrade request
    mapping(address => bool) public upgradeApprovals; // Mapping approvals from authorized signers

    mapping(address => bool) public isAuthorizedSigner; // Mapping of authorized signers
    address[] public authorizedSigners; // List of authorized signers

    uint256 public constant UPGRADE_DELAY = 3 days; // 3 days delay for upgrade
    uint256 public constant MIN_APPROVALS = 2; // Minimum approvals required for upgrade
    bool private _upgrading; // Flag to control upgrade process

    // Event list
    event UpgradeScheduled(address indexed newImplementation, uint256 activationTime);
    event UpgradeCanceled(address indexed newImplementation);
    event Upgraded(address indexed newImplementation);
    event UpgradeApproved(address indexed approver, address indexed newImplementation);

    // Error list
    error InvalidImplementation();
    error UpgradeAlreadyPending();
    error NotAuthorized();
    error UpgradeNotScheduled();
    error ActivationTimePassed();
    error AlreadyApproved();
    error ActivationTimeNotReached();
    error UpgradeNotAuthorized();
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

        // Initialize authorized signers
        isAuthorizedSigner[_chiefTechnologyOfficer] = true;
        isAuthorizedSigner[_financeDepartment] = true;
        isAuthorizedSigner[_chairman] = true;
        // Add authorized signers to the list
        authorizedSigners.push(_chiefTechnologyOfficer);
        authorizedSigners.push(_financeDepartment);
        authorizedSigners.push(_chairman);
    }

    /**
     * @dev Propose an upgrade to the contract
     * @param newImplementation Address of the new implementation
     */
    function proposeUpgrade(address newImplementation) public onlyOwner {
        if (newImplementation == address(0)) {
            revert InvalidImplementation();
        }
        if (pendingUpgrade.newImplementation != address(0)) {
            revert UpgradeAlreadyPending();
        }

        pendingUpgrade = UpgradeRequest({
            newImplementation: newImplementation,
            activationTime: block.timestamp + UPGRADE_DELAY,
            approvalCount: 0
        });

        _resetApprovals();
        emit UpgradeScheduled(newImplementation, pendingUpgrade.activationTime);
    }

    /**
     * @dev Approve the upgrade request
     */
    function approveUpgrade() public onlyAuthorizedSigner {
        if (pendingUpgrade.newImplementation == address(0)) {
            revert UpgradeNotScheduled();
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
    function cancelUpgrade() public onlyOwner {
        if (pendingUpgrade.newImplementation == address(0)) {
            revert UpgradeNotScheduled();
        }
        if (block.timestamp >= pendingUpgrade.activationTime) {
            revert ActivationTimePassed();
        }

        address canceledImplementation = pendingUpgrade.newImplementation;
        _resetPendingUpgrade();
        emit UpgradeCanceled(canceledImplementation);
    }

    /**
     * @dev Execute the upgrade request
     */
    function executeUpgrade() external {
        if (pendingUpgrade.newImplementation == address(0)) {
            revert UpgradeNotScheduled();
        }
        if (block.timestamp < pendingUpgrade.activationTime) {
            revert ActivationTimeNotReached();
        }
        if (pendingUpgrade.approvalCount < MIN_APPROVALS) {
            revert MinimumApprovalsNotReached();
        }

        address newImplementation = pendingUpgrade.newImplementation;
        _upgrading = true;

        // Upgrade the contract
        upgradeToAndCall(newImplementation, new bytes(0));
        _upgrading = false;
        _version += 1;

        _resetPendingUpgrade();
        emit Upgraded(newImplementation);
    }

    // Internal function to reset approvals
    function _resetApprovals() internal {
        uint256 length = authorizedSigners.length;
        for (uint256 i = 0; i < length; ) {
            upgradeApprovals[authorizedSigners[i]] = false;
            unchecked { i++; }
        }
    }

    // Internal function to reset pending upgrade
    function _resetPendingUpgrade() internal {
        _resetApprovals();
        delete pendingUpgrade;
    }

    // Authorize upgrade (called during the upgrade process)
    function _authorizeUpgrade(address) internal view override {
        if (!_upgrading) {
            revert UpgradeNotAuthorized();
        }
    }

    // Get the current version
    function getVersion() public view returns (uint256) {
        return _version;
    }

    // Modifier to check if authorized signer
    modifier onlyAuthorizedSigner() {
        if (!isAuthorizedSigner[msg.sender]) {
            revert NotAuthorized();
        }
        _;
    }
}
