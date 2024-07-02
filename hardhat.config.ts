import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
require("dotenv").config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    hyratest: {
      url: `https://pos-rpc-testnet.hyperaschain.com`,
      accounts: [process.env.ADMIN_PRIVATE_KEY as string],
    },
    bsctest: {
      url: "https://data-seed-prebsc-2-s2.binance.org:8545",
      accounts: [process.env.ADMIN_PRIVATE_KEY as string],
      gasPrice: 5000000000,
    },
    bscmainnet: {
      url: "https://bsc-dataseed1.bnbchain.org/",
      accounts: [process.env.ADMIN_PRIVATE_KEY as string],
      gasPrice: 3000000000,
    },

    arbMainnet: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [process.env.ADMIN_PRIVATE_KEY as string],
    },

    arbTest: {
      url: "https://arbitrum-goerli.publicnode.com",
      accounts: [process.env.ADMIN_PRIVATE_KEY as string],
    },

    arbSepoliaTest: {
      url: "https://arbitrum-sepolia.blockpi.network/v1/rpc/public",
      accounts: [process.env.ADMIN_PRIVATE_KEY as string],
    }

  },
  etherscan: {
    apiKey: process.env.API_KEY_ARBITRUM,
    customChains: [
      {
        network: "Arbitrum Sepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/"
        }
      }
    ]
  },

  sourcify: {
    // Disabled by default
    enabled: true
  }
};

export default config;

