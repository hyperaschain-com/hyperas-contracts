// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HYRA is ERC20, ERC20Burnable, Ownable {
    // Define the maximum supply and initial supply
    uint256 public constant MAX_SUPPLY = 48_500_000_000 * 10 ** 18;
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10 ** 18;

    // Model of pools to receive minted HYRA
    struct Pool {
        uint256 poolId;
        string poolName;
        address poolAddr;
        uint256 poolReceived;
        bool isValid;
    }

    mapping(address => Pool) public poolInfo; // Pools to receive HYRA
    uint256 public numOfPools; // Number of pools
    address [] public poolAddrList; // List of pools

    // error list
    error ExceedsMaxSupply();
    error PoolAlreadyExists();
    error PoolDoesNotExist();

    // event list
    event PoolAdded(string poolName, address poolAddr);
    event PoolDisabled(string poolName, address poolAddr);
    event Minted(address indexed poolAddr, uint256 amount);

    constructor(address _initiatorAddr) ERC20("HYRA", "HYRA") Ownable(msg.sender) {
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
    function mint(address _poolAddr, uint256 _amount) public onlyOwner poolExist(_poolAddr)  {
        if (_amount + totalSupply() > MAX_SUPPLY) {
            revert ExceedsMaxSupply();
        }
        _mint(_poolAddr, _amount);
        poolInfo[_poolAddr].poolReceived += _amount;
        emit Minted(_poolAddr, _amount);
    }

    /**
     * @dev Add a pool for receiving minted HYRA
     * @param _name The name of the pool
     * @param _poolAddr The address of the pool
    */
    function addPool(string memory _name, address _poolAddr) public onlyOwner poolNotExist(_poolAddr){
        poolInfo[_poolAddr].isValid = true;
        numOfPools++;
        poolInfo[_poolAddr] = Pool(numOfPools, _name, _poolAddr, 0, true);
        poolAddrList.push(_poolAddr);
        emit PoolAdded(_name, _poolAddr);
    }

    /**
    * @dev Disable a pool from receiving minted HYRA
    * @param _poolAddr The address of the pool
    */
    function disablePool(address _poolAddr) public onlyOwner poolExist(_poolAddr) {
        poolInfo[_poolAddr].isValid = false;
        string memory _name = poolInfo[_poolAddr].poolName;
        emit PoolDisabled(_name, _poolAddr);
    }

    /**
     * @dev Get the list of pools information
     * @return The list of pools
    */
    function getPools() public view returns (Pool[] memory) {
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
     * @dev Receive ETH
    */
    receive() external payable {}

    /**
    * @dev modifier to check if the pool is exist
    */
    modifier poolExist(address _poolAddr) {
        if (!poolInfo[_poolAddr].isValid) {
            revert PoolDoesNotExist();
        }
        _;
    }

    /**
     * @dev modifier to check if the pool is not exist
    */
    modifier poolNotExist(address _poolAddr) {
        if (poolInfo[_poolAddr].isValid) {
            revert PoolAlreadyExists();
        }
        _;
    }

}