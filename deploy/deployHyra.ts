const { ethers } = require("hardhat");
const fs = require('fs');
// @ts-ignore
import {readFile, saveContractAddressesToFile} from "../services/fileService.ts";

async function main() {
    const hre = require("hardhat");  // Only if not using Hardhat's runtime injection
    const [deployer] = await hre.ethers.getSigners();
    console.log("Account balance:", deployer.address);

    const configData = await readFile("config.json");
    const initiatorAddr = configData['initiatorAddr'];
    console.log("initiatorAddr:", initiatorAddr);

    ///////////////// Deploy Hyra contract /////////////////////
    const hyraTokenFactory = await ethers.getContractFactory("HYRA");
    const hyraContract = await hyraTokenFactory.deploy(initiatorAddr);
    await hyraContract.waitForDeployment();
    console.log("1. Hyra Token address to:", hyraContract.target);
    /////////////////// END Deploy contract /////////////////////


    ///////////////////// Deploy AI POOL contract /////////////////////
    const aiPoolFactory = await ethers.getContractFactory("AIPool");
    const aiPool = await aiPoolFactory.deploy(hyraContract.target);
    await aiPool.waitForDeployment();
    console.log("2. AI Pool address to:", aiPool.target);
    ///////////////////// END Deploy AI POOL contract /////////////////////

    // save contract address to file
    saveContractAddressesToFile("Hyra address ", hyraContract.target, "contract_addresses.json");
    saveContractAddressesToFile("AI Pool address ", aiPool.target, "contract_addresses.json");
    console.log("contract_addresses file created");

    // sleep 10s
    await new Promise(resolve => setTimeout(resolve, 10000));

    ///////////////////// Verify contracts ///////////////////////////
    // 1. Verify hyra contract
    await hre.run("verify:verify", {
        address: hyraContract.target,
        constructorArguments: [initiatorAddr],
    });
    // 3. Verify ai pool contract
    await hre.run("verify:verify", {
        address: aiPool.target,
        constructorArguments: [hyraContract.target],
    });
    console.log("all contracts verified");
    ///////////////////// END Verify contracts ///////////////////////////

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});