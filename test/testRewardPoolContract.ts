import { loadFixture, mine, time} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { describe, it } from "mocha";

describe("Reward Pool Contract", function () {
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
        const rewardPoolDistributionContract = await upgrades.deployProxy(
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
        await rewardPoolDistributionContract.waitForDeployment();
        console.log("Reward Pool deployed at:", rewardPoolDistributionContract.target);

       // transfer eth to reward pool contract
        const ethAmount = ethers.parseEther("1000");
        await deployer.sendTransaction({to: rewardPoolDistributionContract.target, value: ethAmount});
        // sleep 5 second
        await new Promise(resolve => setTimeout(resolve, 5000));

        return {  rewardPoolDistributionContract, deployer, manager, signer, verifier, deliver, normalUser};
    }
    describe("Reward Pool Distribution", function () {
        it("Check roles of the contract", async function () {
            const {  rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver } = await loadFixture(deployContracts);
            const managerAddr = await rewardPoolDistributionContract.manager();
            console.log("managerAddr: ", managerAddr);
            const creatorAddr = await rewardPoolDistributionContract.signer();
            const verifierAddr = await rewardPoolDistributionContract.verifier();
            const deliverAddr = await rewardPoolDistributionContract.deliver();
            expect(managerAddr).to.equal(manager.address);
            expect(creatorAddr).to.equal(signer.address);
            expect(verifierAddr).to.equal(verifier.address);
            expect(deliverAddr).to.equal(deliver.address);
        });

        it("Should not allow a user to claim affiliate reward with a valid signature and not approved from verifier", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            const recipient = normalUser.address;
            // create uid
            const uid = Math.floor(Date.now() / 1000);
            const amount = ethers.parseUnits("1000", 6); // 1000 HYRA
            const nonce = Math.floor(Date.now() / 1000).toString();
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string"],
                [recipient, amount, nonce]
            );
            const signature = await signer.signMessage(ethers.getBytes(messageHash));
            // console.log("signature: ", signature);
            // alice can claim reward
            await expect(rewardPoolDistributionContract.connect(deliver).deliverRewards(recipient,uid, amount, nonce, signature)).
            to.be.revertedWithCustomError(rewardPoolDistributionContract, "UserBillNotApproved");
        });
        it("Should not allow a user to claim affiliate reward with a invalid signature", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            const recipient = normalUser.address;
            const uid = Math.floor(Date.now() / 1000);
            const amount = ethers.parseUnits("100", 18); // 100 HYRA
            const nonce = Math.floor(Date.now() / 1000).toString();
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string"],
                [recipient, amount, nonce]
            );
            const signature = await signer.signMessage(ethers.getBytes(messageHash));

            const fakeSignature = await manager.signMessage(ethers.getBytes(messageHash));
            // approve from verifier
            await rewardPoolDistributionContract.connect(verifier).verifyUserBill(normalUser.address, nonce);
            // alice can claim reward
            await expect(rewardPoolDistributionContract.connect(deliver).deliverRewards(recipient,uid, amount, nonce, fakeSignature)).
            to.be.revertedWithCustomError(rewardPoolDistributionContract, "InvalidSigner");
        });

        it("Should allow a user to claim affiliate reward with a valid signature and approved from verifier", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            const recipient = normalUser.address;
            const uid = Math.floor(Date.now() / 1000);
            const amount = ethers.parseUnits("100", 18); // 100 HYRA
            const nonce = Math.floor(Date.now() / 1000).toString();
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string"],
                [recipient, amount, nonce]
            );
            const signature = await signer.signMessage(ethers.getBytes(messageHash));
            // console.log("signature: ", signature);
            // approve from verifier
            await rewardPoolDistributionContract.connect(verifier).verifyUserBill(normalUser.address, nonce);
            // alice can claim reward
            await rewardPoolDistributionContract.connect(deliver).deliverRewards(recipient,uid, amount, nonce, signature);
            const balanceinContract = await rewardPoolDistributionContract.totalRewardByAddress(normalUser.address);
            expect(balanceinContract).to.equal(amount);
            console.log("normal usser balance: ", ethers.formatUnits(balanceinContract, 18));
        });
        it("Should not allow a user to claim affiliate reward 2 times", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            const recipient = normalUser.address;
            const uid = Math.floor(Date.now() / 1000);
            const amount = ethers.parseUnits("100", 18); // 100 HYRA
            const nonce = Math.floor(Date.now() / 1000).toString();
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string"],
                [recipient, amount, nonce]
            );
            const signature = await signer.signMessage(ethers.getBytes(messageHash));
            // approve from verifier
            await rewardPoolDistributionContract.connect(verifier).verifyUserBill(normalUser.address, nonce);

            // alice can claim reward
            await rewardPoolDistributionContract.connect(deliver).deliverRewards(recipient,uid, amount, nonce, signature);
            const balanceinContract = await rewardPoolDistributionContract.totalRewardByAddress(normalUser.address);
            expect(balanceinContract).to.equal(amount);
            // claim 2nd time
            await expect(rewardPoolDistributionContract.connect(deliver).deliverRewards(recipient, uid, amount, nonce, signature)).to.be.revertedWithCustomError(rewardPoolDistributionContract, "InvalidNonce");
            // await affiliateRewardPoolContract.connect(deliver).claimAffiliateReward(recipient, amount, nonce, signature);
        });
        it("Should not allow a manager to withdraw eth without owner", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            const amount = ethers.parseUnits("1", 6);
            await expect(rewardPoolDistributionContract.connect(manager).withdrawNative(amount)).to.be.revertedWithCustomError(rewardPoolDistributionContract, "AddressNotApproved");
        });
        it("Should not allow another wallet to withdraw eth with approved", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            const amount = ethers.parseUnits("1", 18);
            // aprover manager
            await rewardPoolDistributionContract.connect(deployer).approveAddress(normalUser.address);
            await expect(rewardPoolDistributionContract.connect(normalUser).withdrawNative(amount)).to.be.revertedWithCustomError(rewardPoolDistributionContract, "AccessControlUnauthorizedAccount");
        });
        it("Should allow a manager to withdraw eth with approver of owner", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            const amount = ethers.parseUnits("1", 18);
            // transfer eth to affiliateRewardPool
            await deployer.sendTransaction({
                to: rewardPoolDistributionContract.target,
                value: amount
            });
            // check eth balance of affiliateRewardPool contract
            const balance = await ethers.provider.getBalance(rewardPoolDistributionContract.target);
            console.log("ETH balance in contract: ", ethers.formatUnits(balance, 18));
            // aprover manager
            await rewardPoolDistributionContract.connect(deployer).approveAddress(manager.address);
            // check eth balance of manager before withdraw
            const managerBalanceBefore = await ethers.provider.getBalance(manager.address);
            console.log("manager balance before: ", ethers.formatUnits(managerBalanceBefore, 18));
            // withdraw eth
            await rewardPoolDistributionContract.connect(manager).withdrawNative(amount);
            // check eth balance of contract after withdraw
            const balanceAfter = await ethers.provider.getBalance(rewardPoolDistributionContract.target);
            console.log("ETH balance in contract after: ", ethers.formatUnits(balanceAfter, 18));
            // check eth balance of manager after withdraw
            const managerBalance = await ethers.provider.getBalance(manager.address);
            console.log("manager balance after: ", ethers.formatUnits(managerBalance, 18));
        });

        it("Should not allow deployer to grand a verifier role to another wallet", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            // get VERIFIER_ROLE
            const verifierRole = await rewardPoolDistributionContract.VERIFIER_ROLE();
            console.log("verifierRole: ", verifierRole);
            await expect(rewardPoolDistributionContract.connect(deployer).grantRole(verifierRole, normalUser.address)).to.be.revertedWithCustomError(rewardPoolDistributionContract, "AccessControlUnauthorizedAccount");
            console.log("Done for grant role");
            // check role of normal user
            const hasRole = await rewardPoolDistributionContract.hasRole(verifierRole, normalUser.address);
            console.log("hasRole: ", hasRole);
        });
        it("Should not allow manager to grand a verifier role to another wallet", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            // get VERIFIER_ROLE
            const verifierRole = await rewardPoolDistributionContract.VERIFIER_ROLE();
            console.log("verifierRole: ", verifierRole);
            await expect(rewardPoolDistributionContract.connect(manager).grantRole(verifierRole, normalUser.address)).to.be.revertedWithCustomError(rewardPoolDistributionContract, "AccessControlUnauthorizedAccount");
            console.log("Done for grant role");
            // check role of normal user
            const hasRole = await rewardPoolDistributionContract.hasRole(verifierRole, normalUser.address);
            console.log("hasRole: ", hasRole);
        });
        it("Should not allow creator to grand a verifier role to another wallet", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            // get VERIFIER_ROLE
            const verifierRole = await rewardPoolDistributionContract.VERIFIER_ROLE();
            console.log("verifierRole: ", verifierRole);
            await expect(rewardPoolDistributionContract.connect(signer).grantRole(verifierRole, normalUser.address)).to.be.revertedWithCustomError(rewardPoolDistributionContract, "AccessControlUnauthorizedAccount");
            console.log("Done for grant role");
            // check role of normal user
            const hasRole = await rewardPoolDistributionContract.hasRole(verifierRole, normalUser.address);
            console.log("hasRole: ", hasRole);
        });
        it("Should not allow verifier to grand a verifier role to another wallet", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            // get VERIFIER_ROLE
            const verifierRole = await rewardPoolDistributionContract.VERIFIER_ROLE();
            await expect(rewardPoolDistributionContract.connect(verifier).grantRole(verifierRole, normalUser.address)).to.be.revertedWithCustomError(rewardPoolDistributionContract, "AccessControlUnauthorizedAccount");
            console.log("Done for grant role");
            // check role of normal user
            const hasRole = await rewardPoolDistributionContract.hasRole(verifierRole, normalUser.address);
            console.log("hasRole: ", hasRole);
        });
        it("Should not allow deliver to grand a verifier role to another wallet", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            // get VERIFIER_ROLE
            const verifierRole = await rewardPoolDistributionContract.VERIFIER_ROLE();
            await expect(rewardPoolDistributionContract.connect(deliver).grantRole(verifierRole, normalUser.address)).to.be.revertedWithCustomError(rewardPoolDistributionContract, "AccessControlUnauthorizedAccount");
            console.log("Done for grant role");
            // check role of normal user
            const hasRole = await rewardPoolDistributionContract.hasRole(verifierRole, normalUser.address);
            console.log("hasRole: ", hasRole);
        });


    });

    describe("Check user limit of withdraw", function () {
        // check daily max of withdraw
        it("try to verify max daily amount", async function (){
            const { rewardPoolDistributionContract,
                deployer,
                manager,
                signer,
                verifier,
                deliver,
                normalUser
            } = await loadFixture(deployContracts);

            // create bill 1st time of days
            const recipient = normalUser.address;
            const uid = Math.floor(Date.now() / 1000);
            const amount = ethers.parseUnits("90", 18); // 90 HYRA
            // const nonce = Math.floor(Date.now() / 1000).toString();
            // Lấy khối mới nhất
            const latestBlock0 = await ethers.provider.getBlock("latest");
            const blockchainTime0 = latestBlock0?.timestamp;
            const nonce = blockchainTime0?.toString();
            console.log("nonce: ", nonce);
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string"],
                [recipient, amount, nonce]
            );
            const signature = await signer.signMessage(ethers.getBytes(messageHash));
            // approve from verifier
            await rewardPoolDistributionContract.connect(verifier).verifyUserBill(normalUser.address, nonce);
            // end create bill
            // deliverRewards
            await rewardPoolDistributionContract.connect(deliver).deliverRewards(recipient,uid, amount, nonce, signature);

            // check totalRewardByAddress
            const rewardOfUser = await rewardPoolDistributionContract.totalRewardByAddress(normalUser.address);
            console.log("rewardOfUser: ", ethers.formatUnits(rewardOfUser, 18));

            // get affiliateAddresses list
            const affiliateAddresses = await rewardPoolDistributionContract.getReceivers();
            console.log("affiliateAddresses: ", affiliateAddresses);
            expect(affiliateAddresses[0]).to.equal(normalUser.address);

            //////////////////////////////////////////////////////////////
            // pass 1 hours
            await mine(3600);
            // create bill 2nd time of day
            const amount1 = ethers.parseUnits("10", 18); // 10 HYRA
            // Lấy khối mới nhất
            const latestBlock = await ethers.provider.getBlock("latest");
            const blockchainTime = latestBlock?.timestamp;
            const nonce1 = blockchainTime?.toString();
            // const nonce1 = Math.floor(Date.now() / 1000).toString();
            console.log("nonce1: ", nonce1);
            const messageHash1 = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string"],
                [recipient, amount1, nonce1]
            );
            const signature1 = await signer.signMessage(ethers.getBytes(messageHash1));
            // approve from verifier
            await rewardPoolDistributionContract.connect(verifier).verifyUserBill(normalUser.address, nonce1);
            // end create bill
            // deliverRewards
            await rewardPoolDistributionContract.connect(deliver).deliverRewards(recipient, uid, amount1, nonce1, signature1);

            // check totalAffiliateRewardClaimed
            const totalReward = await rewardPoolDistributionContract.totalRewards();
            console.log("totalReward: ", ethers.formatUnits(totalReward, 6));
            ///////////////////////////////////////////////////////////////
            // pass 1 hour
            await mine(3600);
            // create bill 3rd time of day
            const amount2 = ethers.parseUnits("1000", 18); // 5000 HYRA
            // Lấy khối mới nhất
            const latestBlock2 = await ethers.provider.getBlock("latest");
            const blockchainTime2 = latestBlock2?.timestamp;
            const nonce2 = blockchainTime2?.toString();
            // const nonce2 = Math.floor(Date.now() / 1000).toString();
            console.log("nonce2: ", nonce2);
            const messageHash2 = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string"],
                [recipient, amount2, nonce2]
            );
            const signature2 = await signer.signMessage(ethers.getBytes(messageHash2));
            // approve from verifier
            await rewardPoolDistributionContract.connect(verifier).verifyUserBill(normalUser.address, nonce2);
            // end create bill
            // deliverRewards
            await expect(rewardPoolDistributionContract.connect(deliver).deliverRewards(recipient, uid, amount2, nonce2, signature2)).to.be.revertedWithCustomError(rewardPoolDistributionContract, "ExceedMaxDailyPaymentAmount");
        });

        it("Should not allow withdraw below min amount", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            const recipient = normalUser.address;
            const uid = Math.floor(Date.now() / 1000);
            const amount = ethers.parseUnits("9", 18); // 9 HYRA
            const nonce = Math.floor(Date.now() / 1000).toString();
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string"],
                [recipient, amount, nonce]
            );
            const signature = await signer.signMessage(ethers.getBytes(messageHash));
            // approve from verifier
            await rewardPoolDistributionContract.connect(verifier).verifyUserBill(normalUser.address, nonce);
            // alice can claim reward
            await expect(rewardPoolDistributionContract.connect(deliver).deliverRewards(recipient,uid,  amount, nonce, signature)).to.be.revertedWithCustomError(rewardPoolDistributionContract, "BelowMinPaymentAmount");
        });
        it("Should not allow withdraw exceeds max", async function () {
            const { rewardPoolDistributionContract,deployer, manager, signer, verifier, deliver, normalUser } = await loadFixture(deployContracts);
            const recipient = normalUser.address;
            const uid = Math.floor(Date.now() / 1000);
            const amount = ethers.parseUnits("10001", 18); // 10001 HYRA
            const nonce = Math.floor(Date.now() / 1000).toString();
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "string"],
                [recipient, amount, nonce]
            );
            const signature = await signer.signMessage(ethers.getBytes(messageHash));
            // approve from verifier
            await rewardPoolDistributionContract.connect(verifier).verifyUserBill(normalUser.address, nonce);
            // alice can claim reward
            await expect(rewardPoolDistributionContract.connect(deliver).deliverRewards(recipient, uid,  amount, nonce, signature)).to.be.revertedWithCustomError(rewardPoolDistributionContract, "ExceedMaxPaymentAmount");
        });

    });

});