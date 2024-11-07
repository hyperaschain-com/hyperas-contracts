// Import necessary modules and helpers
import { loadFixture,mine, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("Reward Pool Contract Upgrade Logic", function () {
    async function deployContracts() {
        const [
            deployer,
            manager,
            signer,
            verifier,
            deliver,
            cto,
            financeDept,
            chairman,
            authorizedSigner1,
            authorizedSigner2,
            normalUser,
        ] = await ethers.getSigners();

        // Deploy the RewardPoolDistribution contract
        const RewardPoolDistribution = await ethers.getContractFactory("RewardPoolDistribution");
        const rewardPoolDistribution = await upgrades.deployProxy(
            RewardPoolDistribution,
            [
                manager.address,
                signer.address,
                verifier.address,
                deliver.address,
                cto.address,
                financeDept.address,
                chairman.address,
            ],
            { kind: "uups" }
        );
        await rewardPoolDistribution.waitForDeployment();

        // Transfer ETH to the reward pool contract
        const ethAmount = ethers.parseEther("1000");
        await deployer.sendTransaction({ to: rewardPoolDistribution.target, value: ethAmount });

        // Sleep for a few seconds to ensure the transaction is mined
        await time.increase(1);

        return {
            rewardPoolDistribution,
            deployer,
            manager,
            signer,
            verifier,
            deliver,
            cto,
            financeDept,
            chairman,
            authorizedSigner1,
            authorizedSigner2,
            normalUser,
        };
    }

    describe("Upgrade Logic", function () {
        it("Should propose an upgrade by the owner", async function () {
            const { rewardPoolDistribution, deployer } = await loadFixture(deployContracts);

            // Prepare a new implementation contract
            const RewardPoolDistributionV2 = await ethers.getContractFactory("RewardPoolDistribution");
            const newImplementation = await RewardPoolDistributionV2.deploy();
            await newImplementation.waitForDeployment();
            // console.log("address of new implementation: ", newImplementation.target);
            // console.log("proxy address", rewardPoolDistribution.target);
            // propose an upgrade
            await rewardPoolDistribution.connect(deployer).proposeUpgrade(newImplementation.target);
            // get the pending upgrade details
            const pendingUpgrade = await rewardPoolDistribution.pendingUpgrade();
            // console.log("new implementation address: ", pendingUpgrade);
            // Check the pendingUpgrade details
            expect(pendingUpgrade.newImplementation).to.equal(newImplementation.target);
        });

        it("Should allow authorized signers to approve the upgrade", async function () {
            const { rewardPoolDistribution, cto, financeDept, chairman } = await loadFixture(deployContracts);

            // Prepare a new implementation contract
            const RewardPoolDistributionV2 = await ethers.getContractFactory("RewardPoolDistribution");
            const newImplementation = await RewardPoolDistributionV2.deploy();
            await newImplementation.waitForDeployment();

            // Owner proposes an upgrade
            await rewardPoolDistribution.proposeUpgrade(newImplementation.target);

            // Authorized signers approve the upgrade
            await expect(rewardPoolDistribution.connect(cto).approveUpgrade())
                .to.emit(rewardPoolDistribution, "UpgradeApproved")
                .withArgs(cto.address, newImplementation.target);

            await expect(rewardPoolDistribution.connect(financeDept).approveUpgrade())
                .to.emit(rewardPoolDistribution, "UpgradeApproved")
                .withArgs(financeDept.address, newImplementation.target);

            // Check the approval count
            const pendingUpgrade = await rewardPoolDistribution.pendingUpgrade();
            expect(pendingUpgrade.approvalCount).to.equal(2);
        });

        it("Should not allow unauthorized users to approve the upgrade", async function () {
            const { rewardPoolDistribution, normalUser } = await loadFixture(deployContracts);

            // Attempt to approve upgrade as an unauthorized user
            await expect(rewardPoolDistribution.connect(normalUser).approveUpgrade()).to.be.revertedWithCustomError(
                rewardPoolDistribution,
                "NotAuthorized"
            );
        });

        it("Should not execute the upgrade before activation time", async function () {
            const { rewardPoolDistribution, deployer, cto, financeDept } = await loadFixture(deployContracts);

            // Prepare a new implementation contract
            const RewardPoolDistributionV2 = await ethers.getContractFactory("RewardPoolDistribution");
            const newImplementation = await RewardPoolDistributionV2.deploy();
            await newImplementation.waitForDeployment();

            // Propose and approve the upgrade
            await rewardPoolDistribution.connect(deployer).proposeUpgrade(newImplementation.target);
            await rewardPoolDistribution.connect(cto).approveUpgrade();
            await rewardPoolDistribution.connect(financeDept).approveUpgrade();

            // Attempt to execute the upgrade before activation time
            await expect(rewardPoolDistribution.executeUpgrade()).to.be.revertedWithCustomError(
                rewardPoolDistribution,
                "ActivationTimeNotReached"
            );
        });

        it("A1. Should execute the upgrade after activation time and required approvals", async function () {
            const { rewardPoolDistribution,deployer, cto, financeDept } = await loadFixture(deployContracts);
            // can not call not exist function getTestNumber
            // expect(typeof rewardPoolDistribution.getTestNumber).not.not.equal("function");
            expect(typeof rewardPoolDistribution.getTestNumber).to.equal("undefined");
            // Prepare a new implementation contract
            const RewardPoolDistributionV2 = await ethers.getContractFactory("RewardPoolUpgradeTest");
            const newImplementation = await RewardPoolDistributionV2.deploy();
            await newImplementation.waitForDeployment();
            console.log("proxy address: ", rewardPoolDistribution.target);
            console.log("new implementation address: ", newImplementation.target);

            // Propose and approve the upgrade
            await rewardPoolDistribution.connect(deployer).proposeUpgrade(newImplementation.target);
            await rewardPoolDistribution.connect(cto).approveUpgrade();
            await rewardPoolDistribution.connect(financeDept).approveUpgrade();


            // const pendingUpgrade = await rewardPoolDistribution.pendingUpgrade();
            // const activationTime = pendingUpgrade.activationTime;
            // console.log("activation time: ", activationTime);

            // pass 3 days
            await mine(60 * 60 * 24 * 3);
            // Execute the upgrade
            await expect(rewardPoolDistribution.executeUpgrade())
                .to.emit(rewardPoolDistribution, "Upgraded")
                .withArgs(newImplementation.target);

            // Get upgraded contract instance
            const upgradedContract = RewardPoolDistributionV2.attach(rewardPoolDistribution.target);

            // Verify the version has incremented
            const version = await upgradedContract.getVersion();
            expect(version).to.equal(2);
            // can call new function getTestNumber
            const testNumber = await upgradedContract.getTestNumber();
            // console.log("test number: ", testNumber);
            expect(testNumber).to.equal(1234);
            expect(rewardPoolDistribution.target).to.equal(upgradedContract.target);
            // console.log("proxy address: ", upgradedContract.target);
        });


        it("Should not execute the upgrade without sufficient approvals", async function () {
            const { rewardPoolDistribution, deployer, cto } = await loadFixture(deployContracts);

            // Prepare a new implementation contract
            const RewardPoolDistributionV2 = await ethers.getContractFactory("RewardPoolDistribution");
            const newImplementation = await RewardPoolDistributionV2.deploy();
            await newImplementation.waitForDeployment();

            // Propose and partially approve the upgrade
            await rewardPoolDistribution.connect(deployer).proposeUpgrade(newImplementation.target);
            await rewardPoolDistribution.connect(cto).approveUpgrade();

            // pass 3 days
            await mine(60 * 60 * 24 * 3);
            // Attempt to execute the upgrade
            await expect(rewardPoolDistribution.executeUpgrade()).to.be.revertedWithCustomError(
                rewardPoolDistribution,
                "MinimumApprovalsNotReached"
            );
        });

        it("Should allow the owner to cancel the upgrade before activation time", async function () {
            const { rewardPoolDistribution, cto, deployer } = await loadFixture(deployContracts);

            // Prepare a new implementation contract
            const RewardPoolDistributionV2 = await ethers.getContractFactory("RewardPoolDistribution");
            const newImplementation = await RewardPoolDistributionV2.deploy();
            await newImplementation.waitForDeployment();

            // Propose and approve the upgrade
            await rewardPoolDistribution.connect(deployer).proposeUpgrade(newImplementation.target);
            await rewardPoolDistribution.connect(cto).approveUpgrade();

            // Owner cancels the upgrade
            await expect(rewardPoolDistribution.cancelUpgrade())
                .to.emit(rewardPoolDistribution, "UpgradeCanceled")
                .withArgs(newImplementation.target);

            // Verify that there is no pending upgrade
            const pendingUpgrade = await rewardPoolDistribution.pendingUpgrade();
            const addressZero = "0x0000000000000000000000000000000000000000";
            expect(pendingUpgrade.newImplementation).to.equal(addressZero);
        });

        it("Should not allow cancellation after activation time", async function () {
            const { rewardPoolDistribution, cto, deployer, financeDept, chairman, manager, signer, verifier, deliver } = await loadFixture(deployContracts);

            // Prepare a new implementation contract
            const RewardPoolDistributionV2 = await ethers.getContractFactory("RewardPoolDistribution");
            const newImplementation = await RewardPoolDistributionV2.deploy();
            await newImplementation.waitForDeployment();

            // Propose and approve the upgrade
            await rewardPoolDistribution.connect(deployer).proposeUpgrade(newImplementation.target);
            await rewardPoolDistribution.connect(cto).approveUpgrade();

            // pass 3 days
            await mine(60 * 60 * 24 * 3);

            // Attempt to cancel the upgrade
            await expect(rewardPoolDistribution.cancelUpgrade()).to.be.revertedWithCustomError(
                rewardPoolDistribution,
                "ActivationTimePassed"
            );
        });

        it("Should prevent re-execution of the same upgrade", async function () {
            const { rewardPoolDistribution, deployer, cto, financeDept } = await loadFixture(deployContracts);

            // Prepare a new implementation contract
            const RewardPoolDistributionV2 = await ethers.getContractFactory("RewardPoolUpgradeTest");
            const newImplementation = await RewardPoolDistributionV2.deploy();
            await newImplementation.waitForDeployment();

            // Propose and approve the upgrade
            await rewardPoolDistribution.connect(deployer).proposeUpgrade(newImplementation.target);
            await rewardPoolDistribution.connect(cto).approveUpgrade();
            await rewardPoolDistribution.connect(financeDept).approveUpgrade();

           // pass 3 days
            await mine(60 * 60 * 24 * 3);

            // Execute the upgrade
            await rewardPoolDistribution.executeUpgrade();

            // Attempt to execute the upgrade again
            await expect(rewardPoolDistribution.executeUpgrade()).to.be.revertedWithCustomError(
                rewardPoolDistribution,
                "UpgradeNotScheduled"
            );
        });

        it("Should not allow upgrade in normal way", async function () {
            const { rewardPoolDistribution, deployer, manager, signer, verifier, deliver, cto, financeDept, chairman } = await loadFixture(deployContracts);
            // can not call not exist function getTestNumber
            expect(typeof rewardPoolDistribution.getTestNumber).not.not.equal("function");
            // Prepare a new implementation contract factory
            const RewardPoolDistributionV2 = await ethers.getContractFactory("RewardPoolUpgradeTest");
            console.log("Deploying RewardPoolDistribution as a proxy...");
            // Attempt to upgrade the contract using the proxy address
            await expect(
                upgrades.upgradeProxy(
                    rewardPoolDistribution.target,
                    RewardPoolDistributionV2
                )
            ).to.be.revertedWithCustomError(rewardPoolDistribution, "UpgradeNotAuthorized");
        });

    });
});
