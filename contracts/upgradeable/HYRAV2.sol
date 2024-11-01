// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";


/**
 * @title HYRA as native coin in layer 3 chain
 * @dev This contract is used to mint HYRA to pools
 */
contract HYRAV2 is ERC20Upgradeable, ERC20BurnableUpgradeable, AccessControlUpgradeable{
    // Define the maximum supply and initial supply
    uint256 public constant MAX_SUPPLY = 48_500_000_000 * 10 ** 18;
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10 ** 18;
    // Define roles
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE"); // owner role
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); // Minter role
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE"); // Verifier role

    // Model of pools to receive minted HYRA
    struct Pool {
        uint256 poolId;
        string poolName;
        address poolAddr;
        uint256 poolReceived;
        bool isValid;
    }
    address public verifier; // verifier address
    address public manager; // manager
    address public initialMinter; // initial minter
    uint256 public numOfPools; // Number of pools
    mapping(address => Pool) public poolInfo; // Pools to receive HYRA
    mapping(address => bool) public isPoolVerified; // Pools verified to receive HYRA
    address [] public poolAddrList; // List of pools

    // error list
    error ExceedsMaxSupply();
    error PoolExists();
    error InvalidPool();
    error ZeroAddress();
    error PoolNotVerified();

    // event list
    event PoolAdded(string poolName, address poolAddr);
    event PoolDisabled(string poolName, address poolAddr);
    event PoolEnabled(string poolName, address poolAddr);
    event VerifyPool(address poolAddr);
    event Minted(address indexed poolAddr, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _initiatorAddr, address _manager, address _minter, address _verifier) public initializer {
        __ERC20_init("HYRA", "HYRA");
        __ERC20Burnable_init();
        __AccessControl_init();

        // grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, _manager);
        _grantRole(OWNER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, _minter);
        _grantRole(VERIFIER_ROLE, _verifier);
//        _setRoleAdmin(MINTER_ROLE, DEFAULT_ADMIN_ROLE);
        // set address
        manager = _manager;
        initialMinter = _minter;
        verifier = _verifier;
        // add the initiator to the pools
        addPool("Initiator", _initiatorAddr);
        // mint the initial supply to the initiator
        _mint(_initiatorAddr, INITIAL_SUPPLY);
        poolInfo[_initiatorAddr].poolReceived += INITIAL_SUPPLY;
    }


    /**
     * @dev Mint HYRA to a pool
     * @param _poolAddr The address of the pool
     * @param _amount The amount of HYRA to mint
    */
    function mint(address _poolAddr, uint256 _amount) public onlyRole(MINTER_ROLE) validPool(_poolAddr) {
        // check if the pool address is not zero
        if (_poolAddr == address(0)) {
            revert ZeroAddress();
        }
        // check if the pool is verified
        if (!isPoolVerified[_poolAddr]) {
            revert PoolNotVerified();
        }

        // check if the total supply exceeds the maximum supply
        if (_amount + totalSupply() > MAX_SUPPLY) {
            revert ExceedsMaxSupply();
        }
        // mint the HYRA to the pool
        _mint(_poolAddr, _amount);
        // update the pool received amount
        poolInfo[_poolAddr].poolReceived += _amount;
        // reset the pool for the next mint
        isPoolVerified[_poolAddr] = false;
        emit Minted(_poolAddr, _amount);
    }

    /**
     * @dev verify a pool to receive minted HYRA each time
    */
    function verifyPool(address _poolAddr) public onlyRole(VERIFIER_ROLE) validPool(_poolAddr) {
        isPoolVerified[_poolAddr] = true;
        emit VerifyPool(_poolAddr);
    }

    /**
     * @dev Add a pool for receiving minted HYRA
     * @param _name The name of the pool
     * @param _poolAddr The address of the pool
    */
    function addPool(string memory _name, address _poolAddr) public onlyRole(OWNER_ROLE) invalidPool(_poolAddr) {
        // check if the pool address is not zero
        if (_poolAddr == address(0)) {
            revert ZeroAddress();
        }
        poolInfo[_poolAddr].isValid = true; // set the pool to be valid
        poolInfo[_poolAddr] = Pool(++numOfPools, _name, _poolAddr, 0, true);
        poolAddrList.push(_poolAddr); // add the pool address to the list
        emit PoolAdded(_name, _poolAddr);
    }

    /**
    * @dev Disable a pool from receiving minted HYRA
    * @param _poolAddr The address of the pool
    */
    function disablePool(address _poolAddr) public onlyRole(OWNER_ROLE) validPool(_poolAddr) {
        poolInfo[_poolAddr].isValid = false; // disable the pool
        string memory _name = poolInfo[_poolAddr].poolName;
        emit PoolDisabled(_name, _poolAddr);
    }

    /**
   * @dev Enable a pool from receiving minted HYRA
    * @param _poolAddr The address of the pool
    */
    function enablePool(address _poolAddr) public onlyRole(OWNER_ROLE) {
        // check pool is already added before pool id is not 0
        if (poolInfo[_poolAddr].poolId == 0) {
            revert InvalidPool();
        }
        poolInfo[_poolAddr].isValid = true;
        string memory _name = poolInfo[_poolAddr].poolName;
        emit PoolEnabled(_name, _poolAddr);
    }

    /**
     * @dev Get the list of active pools information
     * @return The list of active pools
     */
    function getActivePools() public view returns (Pool[] memory) {
        uint256 activeCount; // count of active pools
        uint256 poolLength = poolAddrList.length;
        for (uint256 i = 0; i < poolLength; i++) {
            if (poolInfo[poolAddrList[i]].isValid) {
                activeCount++;
            }
        }
        // create a list of active pools
        Pool[] memory _pools = new Pool[](activeCount);
        uint256 index;
        for (uint256 i = 0; i < poolLength; i++) {
            if (poolInfo[poolAddrList[i]].isValid) {
                _pools[index] = poolInfo[poolAddrList[i]];
                index++;
            }
        }
        return _pools;  // return the list of active pools
    }


    /**
     * @dev Get the list of pools information
     * @return The list of pools
    */
    function getAllPools() public view returns (Pool[] memory) {
        // create a list of pools including inactive pools
        Pool[] memory _pools = new Pool[](numOfPools);
        for (uint256 i = 0; i < numOfPools; i++) {
            _pools[i] = poolInfo[poolAddrList[i]];
        }
        return _pools;
    }

    /**
     * @dev Get the pool by address
     * @param _poolAddr The address of the pool
     * @return The pool
    */
    function getPool(address _poolAddr) public view returns (Pool memory) {
        return poolInfo[_poolAddr];
    }

    /**
     * @dev Not allow to receive ETH
    */
    receive() external payable {
        revert("Cannot receive ETH");
    }

    /**
     * @dev modifier to check if the pool is valid
    */
    modifier validPool(address _poolAddr) {
        if (!poolInfo[_poolAddr].isValid) {
            revert InvalidPool();
        }
        _;
    }

    /**
     * @dev modifier to check if the pool is not valid
    */
    modifier invalidPool(address _poolAddr) {
        if (poolInfo[_poolAddr].isValid) {
            revert PoolExists();
        }
        _;
    }



}