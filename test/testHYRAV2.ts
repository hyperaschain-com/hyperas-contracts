import {loadFixture, mine} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import {ethers, upgrades} from "hardhat";
import {describe} from "mocha";



describe("Hyra Contract Development Testing", function () {

    async function deployContracts() {
        const [deployer, alice, bob, cyan, david] = await ethers.getSigners();
        console.log("Deploying contracts with the account:", deployer.address);

        ///////////////// Deploy Hyra contract /////////////////////
        const hyraFactory = await ethers.getContractFactory("HYRAV2");
        const hyraProxyContract = await upgrades.deployProxy(hyraFactory, [deployer.address], {kind: "transparent" });
        await hyraProxyContract.waitForDeployment();
        /////////////////// END Deploy contract /////////////////////


        // ///////////////////// Upgrade Hyra contract /////////////////////
        const hyraUpgradeFactory = await ethers.getContractFactory("HYRAUpgrade");
        const hyraUpgradeProxyContract = await upgrades.upgradeProxy(hyraProxyContract.target, hyraUpgradeFactory); // old proxy address - new proxy factory
        await hyraUpgradeProxyContract.deployTransaction.wait();
        /////////////////////// END Upgrade contract /////////////////////

        ///////////////////////////// Deploy Hyra contract with address /////////////////////////////
        const hyraContractAttach = hyraFactory.attach(hyraProxyContract.target);
        await hyraContractAttach.waitForDeployment();
        console.log("Hyra Token attached address to:", hyraContractAttach.target);

        return { hyraContract: hyraProxyContract, hyraUpgradeProxyContract, deployer, alice, bob, cyan, david };
    }

    describe("Deployment", function () {
        it("Should depoy hyra contract with correct owner", async function () {
            const { deployer, hyraContract, alice } = await loadFixture(deployContracts);
            console.log("HYRA contract address:", hyraContract.target);
            // Check admin role
            const adminRole = await hyraContract.DEFAULT_ADMIN_ROLE();
            console.log("Admin role:", adminRole);
            expect(await hyraContract.hasRole(adminRole, deployer.address)).to.be.true;

            // get HYRA balance of deployer
            const balance = await hyraContract.balanceOf(deployer.address);
            console.log("HYRA balance of deployer:", balance);

            // // Check initial pool
            const initiatorPool = await hyraContract.getPool(deployer.address);
            console.log("Initiator pool:", initiatorPool);
            expect(initiatorPool.isValid).to.be.true;
            expect(initiatorPool.poolName).to.equal("Initiator");
            expect(initiatorPool.poolAddr).to.equal(deployer.address);
        });
        it("check the initial supply", async function () {
            const { deployer, hyraContract, alice } = await loadFixture(deployContracts);
            // get initial supply
            const INITIAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion
            const balance = await hyraContract.balanceOf(deployer.address);
            expect(balance).to.equal(INITIAL_SUPPLY);
        });

        it("check the max supply", async function() {
            const {deployer, hyraContract, alice} = await loadFixture(deployContracts);
            // get max supply
            const MAX_SUPPLY = await hyraContract.MAX_SUPPLY();
            expect(MAX_SUPPLY).to.equal(48500000000n* 10n**18n);
        });
        it("minter role can mint", async function() {
            const {deployer, hyraContract, alice} = await loadFixture(deployContracts);
            const minterRole = await hyraContract.MINTER_ROLE();
            console.log("Minter role:", minterRole);
            // grantRole
            await hyraContract.grantRole(minterRole, alice.address);
            // addPool for alice
            await hyraContract.connect(deployer).addPool("Alice", alice.address);
            // get alice poo
            const alicePool = await hyraContract.getPool(alice.address);
            console.log("Alice pool before mint:", alicePool);
            // mint
            const mintHyra = await hyraContract.connect(alice).mint(alice.address, ethers.parseEther("1000000"));
            // get alice pool àfter mint
            const alicePoolAfterMint = await hyraContract.getPool(alice.address);
            console.log("Alice pool after mint:", alicePoolAfterMint);
            expect(alicePoolAfterMint.isValid).to.be.true;
            expect(alicePoolAfterMint.poolReceived).to.equal(ethers.parseEther("1000000"));
        });
        it("minter role can't mint more than max supply", async function() {
            const {deployer, hyraContract, alice, bob} = await loadFixture(deployContracts);
            const minterRole = await hyraContract.MINTER_ROLE();
            await hyraContract.connect(deployer).grantRole(minterRole, alice.address);
            await hyraContract.connect(deployer).addPool("Alice", alice.address);
            await expect(hyraContract.connect(alice).mint(alice.address, ethers.parseEther("10000000000000000000000000"))).to.be.revertedWithCustomError(hyraContract, "ExceedsMaxSupply");
        });

        it("Only defaut admin can add pool", async function() {
            const {deployer, hyraContract, alice} = await loadFixture(deployContracts);
            await expect(hyraContract.connect(alice).addPool("Alice", alice.address)).to.be.revertedWithCustomError(hyraContract, "AccessControlUnauthorizedAccount");
        });

        it("Only minter role can mint", async function() {
            const {deployer, hyraContract, alice} = await loadFixture(deployContracts);
            await expect(hyraContract.connect(alice).mint(alice.address, ethers.parseEther("1000000"))).to.be.revertedWithCustomError(hyraContract, "AccessControlUnauthorizedAccount");
        });
        it("Calling initialize again should revert", async function() {
            const {deployer, hyraContract, alice} = await loadFixture(deployContracts);
            await expect(hyraContract.initialize(deployer.address)).to.be.revertedWithCustomError(hyraContract, "InvalidInitialization");
        });
        it("check burn HYRA", async function() {
            const {deployer, hyraContract, alice} = await loadFixture(deployContracts);
            // get initial supply
            const initialSupply = await hyraContract.totalSupply();
            console.log("Initial supply:", initialSupply);
            // burn hyra from deployer
            const burnHyra = await hyraContract.connect(deployer).burn(ethers.parseEther("1000000"));
            // get total supply after burn
            const totalSupplyAfterBurn = await hyraContract.totalSupply();
            console.log("Total supply after burn:", totalSupplyAfterBurn);
            expect(initialSupply - totalSupplyAfterBurn ).to.equal(ethers.parseEther("1000000"));
        });
        it("should upgrade contract", async function() {
            const {deployer, hyraContract, hyraUpgradeProxyContract, alice} = await loadFixture(deployContracts);
            // check if the contract is upgraded
            expect(hyraContract.target).to.equal(hyraUpgradeProxyContract.target);
            // hyraContract can not use testUpgrade - new function
            expect(typeof hyraContract.testUpgrade).to.equal("undefined");
            // hyraUpgradeContract can use testUpgrade - new function
            expect(typeof hyraUpgradeProxyContract.testUpgrade).to.equal("function");
            const value = await hyraUpgradeProxyContract.testUpgrade();
            expect(value).to.equal("Upgradeable contract is working");
        });

    });


});
