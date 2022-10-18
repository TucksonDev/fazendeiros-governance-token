///////////////
// Libraries //
///////////////
import hre from "hardhat";

// Library constants
const ethers = hre.ethers;

/////////////////////////////
// Constants and variables //
/////////////////////////////
const etherscanBaseUrl = hre.network.name == "goerli" ? "https://goerli.etherscan.io" : "https://etherscan.io";

const goldTokenId = 1;
const goldTokenMaxSupply = 12;
const goldTokenURI = "ipfs://QmeG6khzQ5pPkhXXA5cyw76QJfRFGUJ3ssxLPYPkcBNTHF";

const memberTokenId = 2;
const memberTokenMaxSupply = 100;
const memberTokenURI = "ipfs://QmXKzUvQTPVKZ8egb1hbf51n9DaiHh5Dbxq9UR8EqJSpVm";

const mintingTokenId = 2;
const mintPrice = 0.5;
const maxAllowancePerWallet = 10;

const secondsToWait = 10;

//////////////////////
// Helper functions //
//////////////////////
async function fallAsleep(n_seconds: number) {
    await new Promise((resolve) => setTimeout(resolve, n_seconds * 1000));
}

///////////////////
// Main function //
///////////////////
async function main() {
    // Initial information
    // -------------------
    console.log("-------------------------");
    console.log("-- INITIATE DEPLOYMENT --");
    console.log("-------------------------");

    // Showing the network in the beginning
    console.log("Network:", hre.network.name);

    // Get deployer from the `accounts` array in hardhat.config.ts
    const [deployer] = await ethers.getSigners();
    console.log("Deployer account:", deployer.address);

    // We also show the balance
    const deployerBalance = await deployer.getBalance();
    console.log("Deployer balance (ETH):", ethers.utils.formatEther(deployerBalance).toString());

    // Contract deployment
    // -------------------
    console.log(" ");
    console.log("*******************");
    console.log("Contract deployment");
    console.log("*******************");

    // Deploy token contract
    console.log("... Deploy token contract ...");
    const TokenContract = await ethers.getContractFactory("FazendeirosDAO");
    const tokenContract = await TokenContract.deploy();
    await tokenContract.deployed();
    console.log("Token contract address:", tokenContract.address);
    console.log("Etherscan URL:", etherscanBaseUrl + "/address/" + tokenContract.address);
    fallAsleep(secondsToWait);

    // Deploy minter contract
    console.log("... Deploy minter contract ...");
    const MinterContract = await ethers.getContractFactory("FazendeirosDAOMinter");
    const minterContract = await MinterContract.deploy(tokenContract.address);
    await minterContract.deployed();
    console.log("Minter contract address:", minterContract.address);
    console.log("Etherscan URL:", etherscanBaseUrl + "/address/" + minterContract.address);
    fallAsleep(secondsToWait);

    // Create token ids
    // -------------------
    console.log(" ");
    console.log("****************");
    console.log("Create token ids");
    console.log("****************");

    console.log("... Create gold token ...");
    console.log(
        "Token ID: " + goldTokenId + " -- " + "MaxSupply: " + goldTokenMaxSupply + " -- " + "URI: " + goldTokenURI
    );

    await tokenContract.createNewTokenId(goldTokenId, goldTokenMaxSupply, goldTokenURI);
    console.log("Token id " + goldTokenId + " created");
    fallAsleep(secondsToWait);

    console.log("... Create member token ...");
    console.log(
        "Token ID: " + memberTokenId + " -- " + "MaxSupply: " + memberTokenMaxSupply + " -- " + "URI: " + memberTokenURI
    );

    await tokenContract.createNewTokenId(memberTokenId, memberTokenMaxSupply, memberTokenURI);
    console.log("Token id " + memberTokenId + " created");
    fallAsleep(secondsToWait);

    // Set token and sale information
    // ------------------------------
    console.log("... Set token and sale information ...");
    console.log(
        "Minting token id: " +
            mintingTokenId +
            " -- " +
            "Mint price: " +
            mintPrice +
            " -- " +
            "Allowance per wallet: " +
            maxAllowancePerWallet
    );
    await minterContract.setTokenInformation(mintingTokenId);
    fallAsleep(secondsToWait);
    await minterContract.setSaleInformation(ethers.utils.parseEther(String(mintPrice)), maxAllowancePerWallet);
    fallAsleep(secondsToWait);
    console.log("Information set");

    // Set minter contract on token contract
    // -------------------------------------
    console.log("... Set minter contract on token contract ...");
    await tokenContract.setMinter(minterContract.address);
    console.log("Minter contract set as " + minterContract.address);

    // Final note
    // ----------
    console.log("... Verify your contracts ...");
    console.log("npx hardhat verify --network " + hre.network.name + " " + tokenContract.address);
    console.log(
        "npx hardhat verify --network " +
            hre.network.name +
            " " +
            minterContract.address +
            ' "' +
            tokenContract.address +
            '"'
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
