import {upgrades} from "hardhat";

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
    const managerAddr = configData['managerAddr'];
    const minterAddr = configData['minterAddr'];
    const verifierAddr = configData['verifierAddr'];

    ///////////////// Deploy Hyra contract /////////////////////
    const hyraFactory = await ethers.getContractFactory("HYRA");
    const hyraProxyContract = await upgrades.deployProxy(hyraFactory, [initiatorAddr, managerAddr,minterAddr, verifierAddr ], {kind: "transparent" });
    await hyraProxyContract.deploymentTransaction();
    console.log("1. Hyra Token address to:", hyraProxyContract.target);
    /////////////////// END Deploy contract /////////////////////


    // save contract address to file
    saveContractAddressesToFile("hyra_contract_address", hyraProxyContract.target, "contract_addresses.json");
    console.log("contract_addresses file created");

    // sleep 10s
    await new Promise(resolve => setTimeout(resolve, 10000));

    ///////////////////// Verify contracts ///////////////////////////
    // 1. Verify hyra contract
    await hre.run("verify:verify", {
        address: hyraProxyContract.target,
        constructorArguments: [initiatorAddr, managerAddr,minterAddr, verifierAddr ],
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