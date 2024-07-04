import {loadFixture, mine} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import {ethers, upgrades} from "hardhat";
import {describe} from "mocha";



describe("Reward Pool Development Testing", function () {

    async function deployContracts() {
        const [deployer, alice, bob, cyan, david] = await ethers.getSigners();
        console.log("Deploying contracts with the account:", deployer.address);

        ///////////////// Deploy Reward Pool Contract /////////////////////
        const rewardPoolV2Factory = await ethers.getContractFactory("RewardPoolV2");
        const rewardPoolV2ProxyContract = await upgrades.deployProxy(rewardPoolV2Factory, [], {kind: "transparent" });
        await rewardPoolV2ProxyContract.waitForDeployment();
        /////////////////// END Deploy contract /////////////////////

        ///////////////////// Upgrade Hyra contract /////////////////////
        // const rewardPoolUpgradeTestFactory = await ethers.getContractFactory("RewardPoolUpgradeTest");
        // const rewardPoolUpgradeProxyContract = await upgradeable.upgradeProxy(rewardPoolV2ProxyContract.target, rewardPoolUpgradeTestFactory); // old proxy address - new proxy factory
        // await rewardPoolUpgradeProxyContract.deployTransaction.wait();
        ///////////////////// END Upgrade contract /////////////////////

        return {rewardPoolV2ProxyContract, deployer, alice, bob, cyan, david };
    }

    describe("Deployment", function () {
        it("check deploy reward pool contract with correct admin role", async function () {
            const { deployer, rewardPoolV2ProxyContract, alice } = await loadFixture(deployContracts);
            console.log("Reward Pool contract address:", rewardPoolV2ProxyContract.target);
            // Check admin role
            const adminRole = await rewardPoolV2ProxyContract.DEFAULT_ADMIN_ROLE();
            console.log("Admin role:", adminRole);
            expect(await rewardPoolV2ProxyContract.hasRole(adminRole, deployer.address)).to.be.true;
        });

        it("Calling initialize again should revert", async function() {
            const {deployer, rewardPoolV2ProxyContract, alice} = await loadFixture(deployContracts);
            await expect(rewardPoolV2ProxyContract.initialize()).to.be.revertedWithCustomError(rewardPoolV2ProxyContract, "InvalidInitialization");
        });

        it("distribution of rewards", async function() {
            const {deployer, rewardPoolV2ProxyContract, alice, bob} = await loadFixture(deployContracts);
            // check deployer eth balance
            const deployerBalance = await ethers.provider.getBalance(deployer.address);
            console.log("Deployer balance:", deployerBalance.toString());
            // transfer eth to reward pool contract
            const ethAmount = ethers.parseEther("1000");
            await deployer.sendTransaction({to: rewardPoolV2ProxyContract.target, value: ethAmount});
            // check reward pool contract eth balance
            const rewardPoolBalance = await ethers.provider.getBalance(rewardPoolV2ProxyContract.target);
            console.log("Reward pool balance:", ethers.formatEther(rewardPoolBalance));

            const rewardPrams = {
                receivers: [alice.address, bob.address],
                amounts: [ethers.parseEther("1000"), ethers.parseEther("2")]
            }
            // grant role
            await rewardPoolV2ProxyContract.grantRole(await rewardPoolV2ProxyContract.DISTRIBUTOR_ROLE(), deployer.address);
            // distribute rewards
            await rewardPoolV2ProxyContract.connect(deployer).distributeReward(rewardPrams.receivers[0], rewardPrams.amounts[0]);
            // check alice and bob balance
            const aliceBalance = await ethers.provider.getBalance(alice.address);
            console.log("Alice balance:", ethers.formatEther(aliceBalance));
            await expect(aliceBalance).to.equal(ethers.parseEther("11000"));
        });

        it("can not distribute rewards if not distributor", async function() {
            const {deployer, rewardPoolV2ProxyContract, alice, bob} = await loadFixture(deployContracts);
            const ethAmount = ethers.parseEther("5000");
            await deployer.sendTransaction({to: rewardPoolV2ProxyContract.target, value: ethAmount});
            const rewardPrams = {
                receivers: [alice.address, bob.address],
                amounts: [ethers.parseEther("1000"), ethers.parseEther("2")]
            }
            // distribute rewards
            await expect(rewardPoolV2ProxyContract.connect(alice).distributeReward(rewardPrams.receivers[0], rewardPrams.amounts[0])).to.be.revertedWithCustomError(rewardPoolV2ProxyContract, "AccessControlUnauthorizedAccount");
        });

        it("can not distribute rewards if not enough eth", async function() {
            const {deployer, rewardPoolV2ProxyContract, alice, bob} = await loadFixture(deployContracts);
            const ethAmount = ethers.parseEther("500");
            await deployer.sendTransaction({to: rewardPoolV2ProxyContract.target, value: ethAmount});
            const rewardPrams = {
                receivers: [alice.address, bob.address],
                amounts: [ethers.parseEther("1000"), ethers.parseEther("20")]
            }
            // grant role
            await rewardPoolV2ProxyContract.grantRole(await rewardPoolV2ProxyContract.DISTRIBUTOR_ROLE(), deployer.address);
            // distribute rewards
            await expect(rewardPoolV2ProxyContract.connect(deployer).distributeReward(rewardPrams.receivers[0], rewardPrams.amounts[0])).to.be.revertedWithCustomError(rewardPoolV2ProxyContract, "InsufficientContractBalance");
        });

        it("can not distribute rewards 2nd time if it shorter than DISTRIBUTION_INTERVAL", async function() {
            const {deployer, rewardPoolV2ProxyContract, alice, bob} = await loadFixture(deployContracts);
            const ethAmount = ethers.parseEther("5000");
            await deployer.sendTransaction({to: rewardPoolV2ProxyContract.target, value: ethAmount});
            const rewardPrams = {
                receivers: [alice.address, bob.address],
                amounts: [ethers.parseEther("1000"), ethers.parseEther("2")]
            }
            // grant role
            await rewardPoolV2ProxyContract.grantRole(await rewardPoolV2ProxyContract.DISTRIBUTOR_ROLE(), deployer.address);
            await rewardPoolV2ProxyContract.connect(deployer).distributeReward(rewardPrams.receivers[0], rewardPrams.amounts[0]);
            // distribute rewards 2nd time
            await expect(rewardPoolV2ProxyContract.connect(deployer).distributeReward(rewardPrams.receivers[0], rewardPrams.amounts[0])).to.be.revertedWithCustomError(rewardPoolV2ProxyContract, "DistributionIntervalNotReached");
        });

        it("can not distribute rewards if exceed max amount each distribution", async function() {
            const {deployer, rewardPoolV2ProxyContract, alice, bob} = await loadFixture(deployContracts);
            const ethAmount = ethers.parseEther("9000");
            await deployer.sendTransaction({to: rewardPoolV2ProxyContract.target, value: ethAmount});
            // check eth of reward pool contract
            const rewardPoolBalance = await ethers.provider.getBalance(rewardPoolV2ProxyContract.target);
            console.log("Reward pool balance:", ethers.formatEther(rewardPoolBalance));
            // setDistributionAmountRange
            await rewardPoolV2ProxyContract.setDistributionAmountRange(ethers.parseEther("4000"), ethers.parseEther("1000"));

            const rewardPrams = {
                receivers: [alice.address, bob.address],
                amounts: [ethers.parseEther("5000"), ethers.parseEther("200")]
            }
            // grant role
            await rewardPoolV2ProxyContract.grantRole(await rewardPoolV2ProxyContract.DISTRIBUTOR_ROLE(), deployer.address);
            // distribute rewards
            await expect(rewardPoolV2ProxyContract.connect(deployer).distributeReward(rewardPrams.receivers[0], rewardPrams.amounts[0])).to.be.revertedWithCustomError(rewardPoolV2ProxyContract, "DistributionAmountOutOfRange");

        });
        // it("should upgrade contract", async function() {
        //     const {deployer, rewardPoolV2ProxyContract, rewardPoolUpgradeProxyContract, alice} = await loadFixture(deployContracts);
        //     // check if the contract is upgraded
        //     expect(rewardPoolV2ProxyContract.target).to.equal(rewardPoolUpgradeProxyContract.target);
        //     // rewardPoolV2ProxyContract can not use testUpgrade - new function
        //     expect(typeof rewardPoolV2ProxyContract.testUpgrade).to.equal("undefined");
        //     // rewardPoolUpgradeProxyContract can use testUpgrade - new function
        //     expect(typeof rewardPoolUpgradeProxyContract.testUpgrade).to.equal("function");
        //     const value = await rewardPoolUpgradeProxyContract.testUpgrade();
        //     expect(value).to.equal("Upgradeable contract is working");
        // });





    });


});
