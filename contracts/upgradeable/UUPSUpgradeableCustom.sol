// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract UUPSUpgradeableCustom is UUPSUpgradeable, OwnableUpgradeable {

    // get current implementation
    uint256 private _version;

    event Upgraded(address indexed implementation);

    // init functions
    function __UUPSUpgradeableCustom_init() internal initializer {
        __Ownable_init(_msgSender());
        __UUPSUpgradeable_init();
        _version = 1;
    }

    // authorize upgrade
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        _version += 1;
        emit Upgraded(newImplementation);
    }

    // get current version
    function getVersion() public view returns (uint256) {
        return _version;
    }
}