import {loadFixture, mine} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import {ethers, upgrades} from "hardhat";
import {describe} from "mocha";
import {min} from "hardhat/internal/util/bigint";



describe("Hyra Contract Development Testing", function () {

    async function deployContracts() {
        const [owner, manager, minter, verifier, secondPool ] = await ethers.getSigners();
        console.log("Owner: Deploying contracts with the account:", owner.address);

        ///////////////// Deploy Hyra contract /////////////////////
        const hyraFactory = await ethers.getContractFactory("HYRA");
        const hyraProxyContract = await upgrades.deployProxy(hyraFactory, [owner.address, manager.address, minter.address, verifier.address], {kind: "transparent" });
        await hyraProxyContract.waitForDeployment();
        /////////////////// END Deploy contract /////////////////////

        return { hyraContract: hyraProxyContract, owner, manager, minter, verifier, secondPool };
    }

    describe("Deployment HYRA contract", function () {
        it("Should deploy HYRA contract with correct owner", async function () {
            const { owner, hyraContract, manager } = await loadFixture(deployContracts);
            console.log("HYRA contract address:", hyraContract.target);

            const adminRole = await hyraContract.DEFAULT_ADMIN_ROLE();
            expect(await hyraContract.hasRole(adminRole, manager.address)).to.be.true;

            const balance = await hyraContract.balanceOf(owner.address);
            console.log("HYRA balance of deployer:", balance);

            const initiatorPool = await hyraContract.getPool(owner.address);
            expect(initiatorPool.isValid).to.be.true;
            expect(initiatorPool.poolName).to.equal("Initiator");
            expect(initiatorPool.poolAddr).to.equal(owner.address);
            expect(initiatorPool.poolReceived).to.equal(ethers.parseEther("1000000000"));
        });

        it("Should have correct initial supply", async function () {
            const { owner, hyraContract } = await loadFixture(deployContracts);
            const INITIAL_SUPPLY = ethers.parseEther("1000000000");
            const balance = await hyraContract.balanceOf(owner.address);
            expect(balance).to.equal(INITIAL_SUPPLY);
        });

        it("Should have correct max supply", async function () {
            const { hyraContract } = await loadFixture(deployContracts);
            const MAX_SUPPLY = await hyraContract.MAX_SUPPLY();
            expect(MAX_SUPPLY).to.equal(48500000000n * 10n**18n);
        });
    });

    describe("Pool Management", function () {
        it("Should add a new pool correctly", async function () {
            const { hyraContract, owner, verifier, secondPool } = await loadFixture(deployContracts);
            await hyraContract.connect(owner).addPool("Second Pool", secondPool.address);
            const pool = await hyraContract.getPool(secondPool.address);
            expect(pool.poolName).to.equal("Second Pool");
            expect(pool.isValid).to.be.true;
        });

        it("Should disable and enable a pool", async function () {
            const { hyraContract, owner, secondPool } = await loadFixture(deployContracts);
            await hyraContract.connect(owner).addPool("Test Pool", secondPool.address);
            await hyraContract.connect(owner).disablePool(secondPool.address);

            let pool = await hyraContract.getPool(secondPool.address);
            expect(pool.isValid).to.be.false;

            await hyraContract.connect(owner).enablePool(secondPool.address);
            pool = await hyraContract.getPool(secondPool.address);
            expect(pool.isValid).to.be.true;
        });
    });

    describe("Minting and Verification", function () {
        it("Should verify and mint tokens to a pool", async function () {
            const { hyraContract, minter, owner, verifier, secondPool } = await loadFixture(deployContracts);
            const mintAmount = ethers.parseEther("1000000");
            // add pool
            await hyraContract.connect(owner).addPool("Second Pool", secondPool.address);
            await hyraContract.connect(verifier).verifyPool(secondPool.address);
            await hyraContract.connect(minter).mint(secondPool.address, mintAmount);

            const poolBalance = await hyraContract.balanceOf(secondPool.address);
            console.log("Pool balance:", poolBalance.toString());
            // expect(poolBalance).to.equal(mintAmount);
            //
            // const pool = await hyraContract.getPool(secondPool.address);
            // expect(pool.poolReceived).to.equal(mintAmount);
        });

        it("Should not mint to unverified pool", async function () {
            const { hyraContract, minter, owner, secondPool } = await loadFixture(deployContracts);
            const mintAmount = ethers.parseEther("1000000");
            // add pool
            await hyraContract.connect(owner).addPool("Second Pool", secondPool.address);
            await expect(hyraContract.connect(minter).mint(secondPool.address, mintAmount))
                .to.be.revertedWithCustomError(hyraContract, "PoolNotVerified");
        });

        it("Should prevent minting over max supply", async function () {
            const { hyraContract, minter, owner, verifier, secondPool } = await loadFixture(deployContracts);
            const excessAmount = ethers.parseEther("48500000001");
            // add pool
            await hyraContract.connect(owner).addPool("Second Pool", secondPool.address);
            await hyraContract.connect(verifier).verifyPool(secondPool.address);
            await expect(hyraContract.connect(minter).mint(secondPool.address, excessAmount))
                .to.be.revertedWithCustomError(hyraContract, "ExceedsMaxSupply");
        });
    });
});

