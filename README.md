# Hyperas Contracts

This repository contains the smart contracts for the Hyperas Chain project, including the HYRA token and the Minimal Reward Pool.

## HYRA Contract

 It implements an upgradeable ERC20 token with additional features.

### Key Functions

#### a. Initialization (initialize)
- Sets up HYRA with the name "HYRA" and the symbol "HYRA".
- Grants admin rights to the contract deployer.
- Adds the initializer address to the pool list and mints the initial token supply to this address.

#### b. Minting Tokens (mint)
- Allows creation of new HYRA and sends them to a designated pool.
- Only addresses with the `MINTER_ROLE` can perform this function.
- Checks to ensure the total supply doesn't exceed the maximum limit.

#### c. Adding a New Pool (addPool)
- Allows the addition of a new pool to receive minted HYRA.
- Only addresses with `DEFAULT_ADMIN_ROLE` can perform this function.

#### d. Disabling a Pool (disablePool)
- Disables a pool, preventing it from receiving additional HYRA.
- Only addresses with admin rights can perform this function.

#### e. Supply Limits
- Maximum total supply is capped at 48.5 billion HYRA.
- Initial supply is set at 1 billion HYRA.

#### f. Token Burning
- Inherits from `ERC20BurnableUpgradeable`, allowing token burning.

#### g. Upgradeability
- The contract is designed to be upgradeable.

## Minimal Reward Pool Contract

This contract manages the distribution of HYRA rewards.

### Key Functions

#### a. Initialization (initialize)
- Sets up basic functions like access control, pausability, and reentrancy guard.
- Grants admin rights to the contract deployer.

#### b. Reward Distribution (distributeReward)
- Distributes HYRA rewards to a specific address.
- Only addresses with `DISTRIBUTOR_ROLE` can perform this function.
- Checks conditions like minimum distribution interval and amount limits.

#### c. Reward Transfer (_transferReward)
- Private function to handle the transfer of rewards.
- Checks conditions before transfer.
- Updates state after successful transfer.

#### d. Pausing and Unpausing (pause/unpause)
- Allows pausing or resuming contract operations.
- Only addresses with admin rights can perform these functions.

#### e. Security
- Uses `ReentrancyGuard` to prevent reentrancy attacks.
- Implements safety checks before transferring rewards.

#### f. Upgradeability
- The contract is designed to be upgradeable.

## Getting Started

To deploy and interact with these contracts, follow these steps:

1. **Prerequisites**
    - Install Node.js (version 14 or later)
    - Install Hardhat: `npm install --save-dev hardhat`
    - Install dependencies: `npm install`

2. **Compilation**
    - Compile the contracts: `npx hardhat compile`

3. **Deployment**
    - Set up your `.env` file with the necessary environment variables (see `.env.example`)
    - Run the deployment script: `npx hardhat run scripts/deploy.js --network <your-network>`

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions to the Hyperas Contracts project! Here's how you can contribute:

1. **Fork the Repository**
    - Fork the project repository to your GitHub account.

2. **Clone the Forked Repository**
    - `git clone https://github.com/your-username/hyperas-contracts.git`
    - `cd hyperas-contracts`

3. **Create a New Branch**
    - `git checkout -b feature/your-feature-name`

4. **Make Your Changes**
    - Implement your feature or bug fix.
    - Add or update tests as necessary.
    - Ensure your code follows the project's coding standards.

5. **Run Tests**
    - Make sure all tests pass: `npx hardhat test`

6. **Commit Your Changes**
    - `git commit -m "Add a descriptive commit message"`

7. **Push to Your Fork**
    - `git push origin feature/your-feature-name`

8. **Create a Pull Request**
    - Go to the original repository on GitHub.
    - Click on "New Pull Request".
    - Select your fork and the branch you created.
    - Provide a clear description of your changes.

9. **Code Review**
    - Wait for the maintainers to review your PR.
    - Make any requested changes.

10. **Merge**
    - Once approved, your PR will be merged into the main branch.

Please ensure you adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) throughout the contribution process.

For major changes, please open an issue first to discuss what you would like to change. This ensures that your efforts align with the project's direction and goals.

Thank you for contributing to Hyperas Contracts!