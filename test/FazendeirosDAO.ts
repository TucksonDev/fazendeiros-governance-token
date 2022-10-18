// Libraries
import { ethers } from "hardhat";
import chai from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MerkleTree } from "merkletreejs";
import { generateMerkleTreeFromAddressList } from "../tasks/generateMerkleTree";
import { getWhitelistHexProof } from "../tasks/getWhitelistProof";

// Library constants
const expect = chai.expect;

////////////////////
// Test Constants //
////////////////////
const TOKEN_CONTRACT_NAME = "FazendeirosDAO";
const MINTER_CONTRACT_NAME = "FazendeirosDAOMinter";

// Tokenomics
const TEST_TOKEN_ID = 1;
const TEST_MAX_SUPPLY = 50;
const TEST_TOKEN_RESOURCE_URI = "ipfs://QmY73kCnAqXooQbK5kUpk2jBF1JvWPBBSR6whRaNMoTsj7";
const TEST_TOKEN_PRICE = 0.5;
const TEST_MAX_ALLOWANCE_PER_WALLET = 20;

const TEST_MINT_AMOUNT = 5;
const TEST_MINT_PRICE = ethers.utils.parseEther(String(TEST_MINT_AMOUNT * TEST_TOKEN_PRICE));
const TEST_MAX_MINT_AMOUNT = TEST_MAX_ALLOWANCE_PER_WALLET;
const TEST_MAX_MINT_PRICE = ethers.utils.parseEther(String(TEST_MAX_MINT_AMOUNT * TEST_TOKEN_PRICE));

// Other contract constants
const SALE_OFF_STATUS = 0;
const PRIVATE_SALE_STATUS = 1;
const PUBLIC_SALE_STATUS = 2;

// Custom errors
const TOKEN_ID_NOT_EDITABLE_ERROR = "Token ID cannot be edited";
const MINTING_FROM_NOT_MINTER_ERROR = "Minting is restricted to the minter address";
const NOT_THE_OWNER_ERROR = "Ownable: caller is not the owner";
const TOKEN_ID_ALREADY_EXISTS_ERROR = "Token ID already exists";
const SALE_PRIVATE_NOT_ACTIVE_ERROR = "Presale is not active";
const SALE_PUBLIC_NOT_ACTIVE_ERROR = "Public sale is not active";
const TOKEN_ID_DOES_NOT_EXIST_ERROR = "Token ID does not exist";
const WRONG_MINT_ALLOWANCE_ERROR = "Amount must be between 1 and " + TEST_MAX_ALLOWANCE_PER_WALLET;
const NO_SUPPLY_AVAILABLE_ERROR = "No supply available to mint that amount";
const NO_ALLOWANCE_LEFT_ERROR =
    "The amount to mint plus the current balance must be lower or equal to " + TEST_MAX_ALLOWANCE_PER_WALLET;
const MINT_PRICE_NOT_CORRECT_ERROR =
    "Price per token should be " + ethers.utils.parseUnits(String(TEST_TOKEN_PRICE), "ether");
const INSUFFICIENT_BALANCE_TO_TRANSFER_ERROR = "ERC1155: insufficient balance for transfer";
const ADDRESS_NOT_WHITELISTED_ERROR = "Address is not whitelisted";

///////////
// TESTS //
///////////
describe("Fazendeiros Governance tests", function () {
    // Test vars
    let tokenContractFactory: ContractFactory;
    let tokenContract: Contract;
    let minterContractFactory: ContractFactory;
    let minterContract: Contract;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let addr3: SignerWithAddress; // Not whitelisted
    let addr4: SignerWithAddress; // Not whitelisted
    let addrs: SignerWithAddress[];
    let merkleTree: MerkleTree;
    let addr1Proof: string[];
    let addr2Proof: string[];
    let allAddrs: SignerWithAddress[];

    // `beforeEach` runs before each test, re-deploying the contract every time.
    beforeEach(async () => {
        // Get several accounts to test
        [owner, addr1, addr2, addr3, addr4, ...addrs] = await ethers.getSigners();
        allAddrs = [owner, addr1, addr2, addr3, addr4, ...addrs];

        // First deploy the token contract
        tokenContractFactory = await ethers.getContractFactory(TOKEN_CONTRACT_NAME);
        tokenContract = await tokenContractFactory.deploy();

        // Then the minter
        minterContractFactory = await ethers.getContractFactory(MINTER_CONTRACT_NAME);
        minterContract = await minterContractFactory.deploy(tokenContract.address);

        // Creating a token ID
        await tokenContract.connect(owner).createNewTokenId(TEST_TOKEN_ID, TEST_MAX_SUPPLY, TEST_TOKEN_RESOURCE_URI);

        // Setting it as the token ID in the minting contract
        await minterContract.connect(owner).setTokenInformation(TEST_TOKEN_ID);

        // Also, setting the sale information
        await minterContract
            .connect(owner)
            .setSaleInformation(ethers.utils.parseEther(String(TEST_TOKEN_PRICE)), TEST_MAX_ALLOWANCE_PER_WALLET);

        // And finally setting the minter address in the token contract
        await tokenContract.setMinter(minterContract.address);

        // Generate merkle tree
        const wlAddresses = [addr1, addr2, ...addrs].map((signer) => signer.address);
        merkleTree = generateMerkleTreeFromAddressList(wlAddresses);

        // Get merkle root and add it to the contract
        const merkleRoot = "0x" + merkleTree.getRoot().toString("hex");
        await minterContract.connect(owner).setMerkleRoot(merkleRoot);

        // Get addr1 and addr2 merkle proofs
        addr1Proof = getWhitelistHexProof(addr1.address, merkleTree);
        addr2Proof = getWhitelistHexProof(addr2.address, merkleTree);
    });

    //
    ////////////////////////////
    // Deployment information //
    ////////////////////////////
    //
    describe("Deployment information", () => {
        it("Should set the right owner for both contracts", async () => {
            expect(await tokenContract.owner()).to.equal(owner.address);
            expect(await minterContract.owner()).to.equal(owner.address);
        });
    });

    //
    ////////////////////////
    // Tokens information //
    ////////////////////////
    //
    describe("Tokens creation and edition", () => {
        const NEW_TOKEN_ID = 2;

        it("Should allow the owner to create a new token ID", async () => {
            await tokenContract.connect(owner).createNewTokenId(NEW_TOKEN_ID, TEST_MAX_SUPPLY, TEST_TOKEN_RESOURCE_URI);
            const tokenInfo = await tokenContract.tokenInfo(NEW_TOKEN_ID);
            expect(tokenInfo.maxSupply).to.equal(TEST_MAX_SUPPLY);
        });

        it("Should FAIL if any user other than the owner tries to create a new token ID", async () => {
            await expect(
                tokenContract.connect(addr1).createNewTokenId(NEW_TOKEN_ID, TEST_MAX_SUPPLY, TEST_TOKEN_RESOURCE_URI)
            ).to.be.revertedWith(NOT_THE_OWNER_ERROR);
        });

        it("Should FAIL if the owner tries to create a token ID that already exists", async () => {
            await tokenContract.connect(owner).createNewTokenId(NEW_TOKEN_ID, TEST_MAX_SUPPLY, TEST_TOKEN_RESOURCE_URI);
            const tokenInfo = await tokenContract.tokenInfo(NEW_TOKEN_ID);
            expect(tokenInfo.maxSupply).to.equal(TEST_MAX_SUPPLY);

            await expect(
                tokenContract.connect(owner).createNewTokenId(NEW_TOKEN_ID, TEST_MAX_SUPPLY, TEST_TOKEN_RESOURCE_URI)
            ).to.be.revertedWith(TOKEN_ID_ALREADY_EXISTS_ERROR);
        });

        it("Should allow changing the information for an existing token ID", async () => {
            await tokenContract.connect(owner).createNewTokenId(NEW_TOKEN_ID, TEST_MAX_SUPPLY, TEST_TOKEN_RESOURCE_URI);
            const tokenInfo = await tokenContract.tokenInfo(NEW_TOKEN_ID);
            expect(tokenInfo.maxSupply).to.equal(TEST_MAX_SUPPLY);

            const newTokenMaxSupply = TEST_MAX_SUPPLY + 100;
            await tokenContract.connect(owner).setTokenIdInfo(NEW_TOKEN_ID, newTokenMaxSupply, TEST_TOKEN_RESOURCE_URI);
            const newTokenInfo = await tokenContract.tokenInfo(NEW_TOKEN_ID);
            expect(newTokenInfo.maxSupply).to.equal(newTokenMaxSupply);
        });

        it("Should FAIL if owner tries to change the information of a token ID that cannot be edited", async () => {
            await tokenContract.connect(owner).createNewTokenId(NEW_TOKEN_ID, TEST_MAX_SUPPLY, TEST_TOKEN_RESOURCE_URI);
            const tokenInfo = await tokenContract.tokenInfo(NEW_TOKEN_ID);
            expect(tokenInfo.maxSupply).to.equal(TEST_MAX_SUPPLY);

            // Disabling edition of the token ID
            await tokenContract.connect(owner).disableTokenEdition(NEW_TOKEN_ID);

            // Trying to change information after disabling edition
            const newTokenMaxSupply = TEST_MAX_SUPPLY + 100;
            await expect(
                tokenContract.connect(owner).setTokenIdInfo(NEW_TOKEN_ID, newTokenMaxSupply, TEST_TOKEN_RESOURCE_URI)
            ).to.be.revertedWith(TOKEN_ID_NOT_EDITABLE_ERROR);
        });

        it("Should FAIL if owner tries to change the information of a non-existant token ID", async () => {
            const newTokenMaxSupply = TEST_MAX_SUPPLY + 100;
            await expect(
                tokenContract.connect(owner).setTokenIdInfo(NEW_TOKEN_ID, newTokenMaxSupply, TEST_TOKEN_RESOURCE_URI)
            ).to.be.revertedWith(TOKEN_ID_DOES_NOT_EXIST_ERROR);
        });

        it("Should FAIL if any user other than the owner tries to change the information of a token ID", async () => {
            await tokenContract.connect(owner).createNewTokenId(NEW_TOKEN_ID, TEST_MAX_SUPPLY, TEST_TOKEN_RESOURCE_URI);
            const tokenInfo = await tokenContract.tokenInfo(NEW_TOKEN_ID);
            expect(tokenInfo.maxSupply).to.equal(TEST_MAX_SUPPLY);

            const newTokenMaxSupply = TEST_MAX_SUPPLY + 100;
            await expect(
                tokenContract.connect(addr1).setTokenIdInfo(NEW_TOKEN_ID, newTokenMaxSupply, TEST_TOKEN_RESOURCE_URI)
            ).to.be.revertedWith(NOT_THE_OWNER_ERROR);

            const newTokenInfo = await tokenContract.tokenInfo(NEW_TOKEN_ID);
            expect(newTokenInfo.maxSupply).to.equal(TEST_MAX_SUPPLY);
        });
    });

    //
    ///////////////////////
    // Sale status tests //
    ///////////////////////
    //
    describe("Sale status", () => {
        it("Should allow the owner to change from private to public status after some mints", async () => {
            // Activating private sale
            await minterContract.connect(owner).setSaleState(PRIVATE_SALE_STATUS);

            // Minting some NFTs
            await minterContract.connect(addr1).presaleMint(TEST_MINT_AMOUNT, addr1Proof, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr2).presaleMint(TEST_MINT_AMOUNT, addr2Proof, { value: TEST_MINT_PRICE });

            // Activating public sale
            await minterContract.connect(owner).setSaleState(PUBLIC_SALE_STATUS);

            // Minting some more NFTs
            await minterContract.connect(addr3).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr4).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });

            // Minted supply
            const totalSupply = await tokenContract.tokenTotalSupply(TEST_TOKEN_ID);
            expect(totalSupply).to.equal(TEST_MINT_AMOUNT * 4);
        });

        it("Should allow the owner to change from public to private status after some mints", async () => {
            // Activating public sale
            await minterContract.connect(owner).setSaleState(PUBLIC_SALE_STATUS);

            // Minting some more NFTs
            await minterContract.connect(addr3).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr4).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });

            // Activating private sale
            await minterContract.connect(owner).setSaleState(PRIVATE_SALE_STATUS);

            // Minting some NFTs
            await minterContract.connect(addr1).presaleMint(TEST_MINT_AMOUNT, addr1Proof, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr2).presaleMint(TEST_MINT_AMOUNT, addr2Proof, { value: TEST_MINT_PRICE });

            // Minted supply
            const totalSupply = await tokenContract.tokenTotalSupply(TEST_TOKEN_ID);
            expect(totalSupply).to.equal(TEST_MINT_AMOUNT * 4);
        });

        it("Should allow the owner to stop the private sale after some mints", async () => {
            // Activating private sale
            await minterContract.connect(owner).setSaleState(PRIVATE_SALE_STATUS);

            // Minting some NFTs
            await minterContract.connect(addr1).presaleMint(TEST_MINT_AMOUNT, addr1Proof, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr2).presaleMint(TEST_MINT_AMOUNT, addr2Proof, { value: TEST_MINT_PRICE });

            // Stop the mint
            await minterContract.connect(owner).setSaleState(SALE_OFF_STATUS);

            // Trying to mint while the sale is not active
            await expect(
                minterContract.connect(addr1).presaleMint(TEST_MINT_AMOUNT, addr1Proof, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(SALE_PRIVATE_NOT_ACTIVE_ERROR);

            // Trying to mint while the sale is not active
            await expect(
                minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(SALE_PUBLIC_NOT_ACTIVE_ERROR);

            // Minted supply
            const totalSupply = await tokenContract.tokenTotalSupply(TEST_TOKEN_ID);
            expect(totalSupply).to.equal(TEST_MINT_AMOUNT * 2);
        });

        it("Should allow the owner to stop the public sale after some mints", async () => {
            // Activating public sale
            await minterContract.connect(owner).setSaleState(PUBLIC_SALE_STATUS);

            // Minting some more NFTs
            await minterContract.connect(addr3).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr4).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });

            // Stop the mint
            await minterContract.connect(owner).setSaleState(SALE_OFF_STATUS);

            // Trying to mint while the sale is not active
            await expect(
                minterContract.connect(addr1).presaleMint(TEST_MINT_AMOUNT, addr1Proof, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(SALE_PRIVATE_NOT_ACTIVE_ERROR);

            // Trying to mint while the sale is not active
            await expect(
                minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(SALE_PUBLIC_NOT_ACTIVE_ERROR);

            // Minted supply
            const totalSupply = await tokenContract.tokenTotalSupply(TEST_TOKEN_ID);
            expect(totalSupply).to.equal(TEST_MINT_AMOUNT * 2);
        });

        it("Should FAIL if somebody tries to private-mint while the sale is not active", async () => {
            // Trying to mint while the sale is not active
            await expect(
                minterContract.connect(addr1).presaleMint(TEST_MINT_AMOUNT, addr1Proof, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(SALE_PRIVATE_NOT_ACTIVE_ERROR);
        });

        it("Should FAIL if somebody tries to public-mint while the sale is not active", async () => {
            // Trying to mint while the sale is not active
            await expect(
                minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(SALE_PUBLIC_NOT_ACTIVE_ERROR);
        });

        it("Should FAIL if somebody tries to public-mint while the private sale is active", async () => {
            // Activating private sale
            await minterContract.connect(owner).setSaleState(PRIVATE_SALE_STATUS);

            // Trying to mint while the sale is not active
            await expect(
                minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(SALE_PUBLIC_NOT_ACTIVE_ERROR);
        });

        it("Should allow the owner to mint any amount directly from the token contract regardless of the sale state", async () => {
            // Disabling sale
            await minterContract.connect(owner).setSaleState(SALE_OFF_STATUS);

            await tokenContract.connect(owner).ownerMint(addr1.address, TEST_TOKEN_ID, TEST_MINT_AMOUNT);
            const addr1Balance = await tokenContract.balanceOf(addr1.address, TEST_TOKEN_ID);
            expect(addr1Balance).to.equal(TEST_MINT_AMOUNT);

            // Private sale
            await minterContract.connect(owner).setSaleState(PRIVATE_SALE_STATUS);

            await tokenContract.connect(owner).ownerMint(addr1.address, TEST_TOKEN_ID, TEST_MAX_MINT_AMOUNT);
            const addr1Balance2 = await tokenContract.balanceOf(addr1.address, TEST_TOKEN_ID);
            expect(addr1Balance2).to.equal(TEST_MINT_AMOUNT + TEST_MAX_MINT_AMOUNT);

            // Public sale
            await minterContract.connect(owner).setSaleState(PUBLIC_SALE_STATUS);

            await tokenContract.connect(owner).ownerMint(addr1.address, TEST_TOKEN_ID, TEST_MAX_MINT_AMOUNT);
            const addr1Balance3 = await tokenContract.balanceOf(addr1.address, TEST_TOKEN_ID);
            expect(addr1Balance3).to.equal(TEST_MINT_AMOUNT + TEST_MAX_MINT_AMOUNT * 2);
        });

        it("Should FAIL if anybody else tries to mint directly from the token contract regardless of the sale state", async () => {
            // Disabling sale
            await minterContract.connect(owner).setSaleState(SALE_OFF_STATUS);

            // Minting with address
            await expect(
                tokenContract.connect(addr1).proxiedMint(addr1.address, TEST_TOKEN_ID, TEST_MINT_AMOUNT)
            ).to.be.revertedWith(MINTING_FROM_NOT_MINTER_ERROR);

            // Minting with owner
            await expect(
                tokenContract.connect(owner).proxiedMint(addr1.address, TEST_TOKEN_ID, TEST_MINT_AMOUNT)
            ).to.be.revertedWith(MINTING_FROM_NOT_MINTER_ERROR);
        });
    });

    //
    //////////////////////////
    // Minting access tests //
    //////////////////////////
    //
    describe("Minting access", () => {
        beforeEach(async () => {
            // Activating public sale
            await minterContract.connect(owner).setSaleState(PUBLIC_SALE_STATUS);
        });

        it("Should allow the minter contract to mint", async () => {
            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            const addr1Balance = await tokenContract.balanceOf(addr1.address, TEST_TOKEN_ID);
            expect(addr1Balance).to.equal(TEST_MINT_AMOUNT);
        });

        it("Should allow the owner to mint from the token contract", async () => {
            await tokenContract.connect(owner).ownerMint(addr1.address, TEST_TOKEN_ID, TEST_MINT_AMOUNT);
            const addr1Balance = await tokenContract.balanceOf(addr1.address, TEST_TOKEN_ID);
            expect(addr1Balance).to.equal(TEST_MINT_AMOUNT);
        });

        it("Should FAIL if anybody else tries to mint from the token contract", async () => {
            // Minting with address (Proxied mint and owner mint)
            await expect(
                tokenContract.connect(addr1).proxiedMint(addr1.address, TEST_TOKEN_ID, TEST_MINT_AMOUNT)
            ).to.be.revertedWith(MINTING_FROM_NOT_MINTER_ERROR);

            await expect(
                tokenContract.connect(addr1).ownerMint(addr1.address, TEST_TOKEN_ID, TEST_MINT_AMOUNT)
            ).to.be.revertedWith(NOT_THE_OWNER_ERROR);

            // Minting with owner (Proxied mint, owner mint is available)
            await expect(
                tokenContract.connect(owner).proxiedMint(addr1.address, TEST_TOKEN_ID, TEST_MINT_AMOUNT)
            ).to.be.revertedWith(MINTING_FROM_NOT_MINTER_ERROR);
        });

        it("Should FAIL when minting from the minter if the minter address is set to zero", async () => {
            // Setting the zero address as minter
            await tokenContract.setMinter(ethers.constants.AddressZero);

            // Trying to mint with minter
            await expect(
                minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(MINTING_FROM_NOT_MINTER_ERROR);
        });

        it("Should allow the minter to mint again if the minter is set to zero and then reset to the minter address", async () => {
            // Setting the zero address as minter
            await tokenContract.setMinter(ethers.constants.AddressZero);

            // Trying to mint with minter
            await expect(
                minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(MINTING_FROM_NOT_MINTER_ERROR);

            // Setting again the minter address as minter
            await tokenContract.setMinter(minterContract.address);

            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            const addr1Balance = await tokenContract.balanceOf(addr1.address, TEST_TOKEN_ID);
            expect(addr1Balance).to.equal(TEST_MINT_AMOUNT);
        });
    });

    //
    ///////////////////////////////////////
    // Presale minting success scenarios //
    ///////////////////////////////////////
    //
    describe("Presale minting success scenarios", () => {
        // `beforeEach` runs before each test in this block, activating presale minting
        beforeEach(async () => {
            // Activating private sale
            await minterContract.connect(owner).setSaleState(PRIVATE_SALE_STATUS);
        });

        it("Should allow anybody whitelisted to mint an NFT for themselves and change its balance and ownership", async () => {
            await minterContract.connect(addr1).presaleMint(TEST_MINT_AMOUNT, addr1Proof, { value: TEST_MINT_PRICE });
            const addr1Balance = await tokenContract.balanceOf(addr1.address, TEST_TOKEN_ID);
            expect(addr1Balance).to.equal(TEST_MINT_AMOUNT);
        });

        it("Should keep track of the minted supply", async () => {
            await minterContract.connect(addr1).presaleMint(TEST_MINT_AMOUNT, addr1Proof, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr2).presaleMint(TEST_MINT_AMOUNT, addr2Proof, { value: TEST_MINT_PRICE });
            const totalSupply = await tokenContract.totalSupply();
            expect(totalSupply).to.equal(TEST_MINT_AMOUNT * 2);
            const tokenTotalSupply = await tokenContract.tokenTotalSupply(TEST_TOKEN_ID);
            expect(tokenTotalSupply).to.equal(TEST_MINT_AMOUNT * 2);
        });

        it("Should add up all funds and keep them in the contract", async () => {
            await minterContract.connect(addr1).presaleMint(TEST_MINT_AMOUNT, addr1Proof, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr2).presaleMint(TEST_MINT_AMOUNT, addr2Proof, { value: TEST_MINT_PRICE });

            const contractBalanceRaw = await ethers.provider.getBalance(minterContract.address);
            const contractBalance = Number(ethers.utils.formatEther(contractBalanceRaw));
            const expectedBalance = Number(ethers.utils.formatEther(TEST_MINT_PRICE));
            expect(contractBalance).to.equal(expectedBalance * 2);
        });
    });

    //
    ////////////////////////////////////
    // Presale minting FAIL scenarios //
    ////////////////////////////////////
    //
    describe("Presale minting FAIL scenarios", () => {
        // `beforeEach` runs before each test in this block, activating presale minting
        beforeEach(async () => {
            // Activating private sale
            await minterContract.connect(owner).setSaleState(PRIVATE_SALE_STATUS);
        });

        it("Should FAIL if somebody who's not whitelisted tries to mint", async () => {
            // Trying to mint with non whitelisted address
            await expect(
                minterContract.connect(addr3).presaleMint(TEST_MINT_AMOUNT, addr1Proof, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(ADDRESS_NOT_WHITELISTED_ERROR);
        });

        it("Should FAIL if somebody tries to mint with 0x0 or [] proof", async () => {
            // Trying to mint with general proof (whitelisted and not whitelisted)
            await expect(
                minterContract.connect(addr1).presaleMint(TEST_MINT_AMOUNT, [], { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(ADDRESS_NOT_WHITELISTED_ERROR);

            await expect(
                minterContract
                    .connect(addr1)
                    .presaleMint(
                        TEST_MINT_AMOUNT,
                        ["0x0000000000000000000000000000000000000000000000000000000000000000"],
                        { value: TEST_MINT_PRICE }
                    )
            ).to.be.revertedWith(ADDRESS_NOT_WHITELISTED_ERROR);

            await expect(
                minterContract.connect(addr3).presaleMint(TEST_MINT_AMOUNT, [], { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(ADDRESS_NOT_WHITELISTED_ERROR);

            await expect(
                minterContract
                    .connect(addr3)
                    .presaleMint(
                        TEST_MINT_AMOUNT,
                        ["0x0000000000000000000000000000000000000000000000000000000000000000"],
                        { value: TEST_MINT_PRICE }
                    )
            ).to.be.revertedWith(ADDRESS_NOT_WHITELISTED_ERROR);
        });

        it("Should FAIL if somebody tries to mint with wrong proof", async () => {
            // Trying to mint with wrong proof
            await expect(
                minterContract.connect(addr1).presaleMint(TEST_MINT_AMOUNT, addr2Proof, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(ADDRESS_NOT_WHITELISTED_ERROR);
        });

        it("Should FAIL if somebody tries to public mint", async () => {
            // Trying to mint while the sale is not active
            await expect(
                minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(SALE_PUBLIC_NOT_ACTIVE_ERROR);
        });

        it("Should FAIL if somebody tries to mint more than the maximum mint amount", async () => {
            const tokenAmount = TEST_MAX_ALLOWANCE_PER_WALLET + 1;
            const mintPrice = ethers.utils.parseEther(String(TEST_TOKEN_PRICE * tokenAmount));

            // Trying to mint more than the maximum tokens allowed
            await expect(
                minterContract.connect(addr1).presaleMint(tokenAmount, addr1Proof, { value: mintPrice })
            ).to.be.revertedWith(WRONG_MINT_ALLOWANCE_ERROR);
        });

        it("Should FAIL if someone tries to mint paying less than the mint price", async () => {
            const failTestAmount = TEST_MINT_AMOUNT + 1;

            await expect(
                minterContract.connect(addr1).presaleMint(failTestAmount, addr1Proof, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(MINT_PRICE_NOT_CORRECT_ERROR);
        });
    });

    //
    ///////////////////
    // Minting tests //
    ///////////////////
    //
    describe("Public minting success scenarios", () => {
        beforeEach(async () => {
            // Activating public sale
            await minterContract.connect(owner).setSaleState(PUBLIC_SALE_STATUS);
        });

        it("Should allow anybody who's whitelisted to mint an NFT for themselves and change its balance and ownership", async () => {
            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            const addr1Balance = await tokenContract.balanceOf(addr1.address, TEST_TOKEN_ID);
            expect(addr1Balance).to.equal(TEST_MINT_AMOUNT);
        });

        it("Should allow anybody who's not whitelisted to mint an NFT for themselves and change its balance and ownership", async () => {
            await minterContract.connect(addr3).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            const addr3Balance = await tokenContract.balanceOf(addr3.address, TEST_TOKEN_ID);
            expect(addr3Balance).to.equal(TEST_MINT_AMOUNT);
        });

        it("Should keep track of the minted supply", async () => {
            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr2).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            const totalSupply = await tokenContract.totalSupply();
            expect(totalSupply).to.equal(TEST_MINT_AMOUNT * 2);
            const tokenTotalSupply = await tokenContract.tokenTotalSupply(TEST_TOKEN_ID);
            expect(tokenTotalSupply).to.equal(TEST_MINT_AMOUNT * 2);
        });

        it("Should add up the minted supplies for all tokens", async () => {
            // Create a new token id
            const NEW_TOKEN_ID = TEST_TOKEN_ID + 1;
            await tokenContract.connect(owner).createNewTokenId(NEW_TOKEN_ID, TEST_MAX_SUPPLY, TEST_TOKEN_RESOURCE_URI);

            // Minting the first token id
            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });

            // Minting the second token id
            await minterContract.setTokenInformation(NEW_TOKEN_ID);
            await minterContract.connect(addr2).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });

            const tokenTotalSupply = await tokenContract.tokenTotalSupply(TEST_TOKEN_ID);
            expect(tokenTotalSupply).to.equal(TEST_MINT_AMOUNT);

            const totalSupply = await tokenContract.totalSupply();
            expect(totalSupply).to.equal(TEST_MINT_AMOUNT * 2);
        });

        it("Should add up all funds and keep them in the contract", async () => {
            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr2).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });

            const contractBalanceRaw = await ethers.provider.getBalance(minterContract.address);
            const contractBalance = Number(ethers.utils.formatEther(contractBalanceRaw));
            const expectedBalance = Number(ethers.utils.formatEther(TEST_MINT_PRICE));
            expect(contractBalance).to.equal(expectedBalance * 2);
        });
    });

    //
    ///////////////////////////////////
    // Public minting FAIL scenarios //
    ///////////////////////////////////
    //
    describe("Public minting FAIL scenarios", () => {
        // `beforeEach` runs before each test in this block, activating public minting
        beforeEach(async () => {
            // Activating public sale
            await minterContract.connect(owner).setSaleState(PUBLIC_SALE_STATUS);
        });

        it("Should FAIL when minting a non-existant token ID from contract", async () => {
            // TEST_TOKEN_ID + 1 should not exist at this point
            const failTestTokenId = TEST_TOKEN_ID + 1;

            await expect(
                tokenContract.connect(owner).ownerMint(addr1.address, failTestTokenId, TEST_MINT_AMOUNT)
            ).to.be.revertedWith(TOKEN_ID_DOES_NOT_EXIST_ERROR);
        });

        it("Should FAIL if someone tries to mint more than the available supply for a specific token ID", async () => {
            if (TEST_MAX_SUPPLY / TEST_MAX_MINT_AMOUNT > 4) {
                expect.fail(
                    0,
                    1,
                    "Test can't be performed with the current values of TEST_MAX_SUPPLY and TEST_MAX_MINT_AMOUNT"
                );
                return;
            }

            // Minting all supply except a few
            for (let i = 1; i <= TEST_MAX_SUPPLY / TEST_MAX_MINT_AMOUNT; i++) {
                await minterContract
                    .connect(allAddrs[i])
                    .publicMint(TEST_MAX_MINT_AMOUNT, { value: TEST_MAX_MINT_PRICE });
            }

            // Try to max mint when there's no supply left
            await expect(
                minterContract.connect(owner).publicMint(TEST_MAX_MINT_AMOUNT, { value: TEST_MAX_MINT_PRICE })
            ).to.be.revertedWith(NO_SUPPLY_AVAILABLE_ERROR);

            // But supply can be fully minted
            const currentSupply = await tokenContract.tokenTotalSupply(TEST_TOKEN_ID);
            const testAmountLeft = TEST_MAX_SUPPLY - currentSupply;
            const testPriceLeft = ethers.utils.parseEther(String(testAmountLeft * TEST_TOKEN_PRICE));
            await minterContract.connect(owner).publicMint(testAmountLeft, { value: testPriceLeft });

            // And supply is maxed
            const totalSupply = await tokenContract.tokenTotalSupply(TEST_TOKEN_ID);
            expect(totalSupply).to.equal(TEST_MAX_SUPPLY);
        });

        it("Should FAIL if someone tries to mint more than the allowance per wallet in one time", async () => {
            const failTestAmount = TEST_MAX_ALLOWANCE_PER_WALLET + 1;
            const failTestPrice = ethers.utils.parseEther(String(failTestAmount * TEST_TOKEN_PRICE));

            await expect(
                minterContract.connect(addr1).publicMint(failTestAmount, { value: failTestPrice })
            ).to.be.revertedWith(WRONG_MINT_ALLOWANCE_ERROR);
        });

        it("Should FAIL if someone tries to mint more than the allowance per wallet in multiple times", async () => {
            // We first mint some tokens
            const testAmount = TEST_MAX_ALLOWANCE_PER_WALLET - 1;
            const testPrice = ethers.utils.parseEther(String(testAmount * TEST_TOKEN_PRICE));
            await minterContract.connect(addr1).publicMint(testAmount, { value: testPrice });

            // And now we try to mint more than we can
            const failTestAmount = 2;
            const failTestPrice = ethers.utils.parseEther(String(failTestAmount * TEST_TOKEN_PRICE));

            await expect(
                minterContract.connect(addr1).publicMint(failTestAmount, { value: failTestPrice })
            ).to.be.revertedWith(NO_ALLOWANCE_LEFT_ERROR);
        });

        it("Should FAIL if someone tries to mint more than it is allowed by transferring its tokens elsewhere", async () => {
            // We first mint some tokens
            const testAmount = TEST_MAX_ALLOWANCE_PER_WALLET - 1;
            const testPrice = ethers.utils.parseEther(String(testAmount * TEST_TOKEN_PRICE));
            await minterContract.connect(addr1).publicMint(testAmount, { value: testPrice });

            // We now transfer half the minted tokens to another address
            const tokensToTransfer = Math.floor(testAmount / 2);
            await tokenContract
                .connect(addr1)
                .safeTransferFrom(addr1.address, addr2.address, TEST_TOKEN_ID, tokensToTransfer, []);

            // And now we try to mint more than we can
            const failTestAmount = 2;
            const failTestPrice = ethers.utils.parseEther(String(failTestAmount * TEST_TOKEN_PRICE));

            await expect(
                minterContract.connect(addr1).publicMint(failTestAmount, { value: failTestPrice })
            ).to.be.revertedWith(NO_ALLOWANCE_LEFT_ERROR);
        });

        it("Should FAIL if someone tries to mint paying less than the mint price", async () => {
            const failTestAmount = TEST_MINT_AMOUNT + 1;

            await expect(
                minterContract.connect(addr1).publicMint(failTestAmount, { value: TEST_MINT_PRICE })
            ).to.be.revertedWith(MINT_PRICE_NOT_CORRECT_ERROR);
        });
    });

    //
    ////////////////////
    // Transfer tests //
    ////////////////////
    //
    describe("Transfer tests", () => {
        beforeEach(async () => {
            // Activating public sale
            await minterContract.connect(owner).setSaleState(PUBLIC_SALE_STATUS);
        });

        it("Should allow transferring", async () => {
            // We first mint some tokens
            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });

            // Getting current balances
            const addr1Balance = await tokenContract.balanceOf(addr1.address, TEST_TOKEN_ID);
            const addr2Balance = await tokenContract.balanceOf(addr2.address, TEST_TOKEN_ID);

            // Assertions
            expect(addr1Balance).to.equal(TEST_MINT_AMOUNT);
            expect(addr2Balance).to.equal(0);

            // Transferring 1 token
            const tokensToTransfer = 1;
            await tokenContract
                .connect(addr1)
                .safeTransferFrom(addr1.address, addr2.address, TEST_TOKEN_ID, tokensToTransfer, []);

            // Getting new balances
            const newAddr1Balance = await tokenContract.balanceOf(addr1.address, TEST_TOKEN_ID);
            const newAddr2Balance = await tokenContract.balanceOf(addr2.address, TEST_TOKEN_ID);

            // Assertions
            expect(newAddr1Balance).to.equal(addr1Balance - tokensToTransfer);
            expect(newAddr2Balance).to.equal(addr2Balance + tokensToTransfer);
        });

        it("Should FAIL if someone tries to transfer more tokens than he owns", async () => {
            // We first mint some tokens
            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });

            // Transferring more tokens than he owns
            const tokensToTransfer = TEST_MINT_AMOUNT + 1;
            await expect(
                tokenContract
                    .connect(addr1)
                    .safeTransferFrom(addr1.address, addr2.address, TEST_TOKEN_ID, tokensToTransfer, [])
            ).to.be.revertedWith(INSUFFICIENT_BALANCE_TO_TRANSFER_ERROR);
        });
    });

    //
    ////////////////////
    // Withdraw funds //
    ////////////////////
    //
    describe("Withdraw funds", () => {
        // `beforeEach` runs before each test in this block, activating public minting
        beforeEach(async () => {
            // Activating public sale
            await minterContract.connect(owner).setSaleState(PUBLIC_SALE_STATUS);
        });

        it("Should allow owner to withdraw funds", async () => {
            // Minting NFTs
            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });
            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });

            // Current contract and owner balances
            const currentContractBalanceRaw = await ethers.provider.getBalance(minterContract.address);
            const currentOwnerBalanceRaw = await ethers.provider.getBalance(owner.address);

            // Withdraw by owner
            const tx = await minterContract.connect(owner).withdraw();
            const txReceipt = await tx.wait();
            const gasUsedRaw = ethers.BigNumber.from(txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice));

            // Check final balances
            const finalContractBalanceRaw = await ethers.provider.getBalance(minterContract.address);
            const finalContractBalance = Number(ethers.utils.formatEther(finalContractBalanceRaw));
            const finalOwnerBalanceRaw = await ethers.provider.getBalance(owner.address);
            const finalOwnerBalance = Number(ethers.utils.formatEther(finalOwnerBalanceRaw));

            // Testing final values
            const expectedOwnerBalance = Number(
                ethers.utils.formatEther(currentOwnerBalanceRaw.add(gasUsedRaw).add(currentContractBalanceRaw))
            );
            expect(finalContractBalance).to.equal(0);
            expect(finalOwnerBalance.toFixed(2)).to.equal(expectedOwnerBalance.toFixed(2));
        });

        it("Should FAIL if any other user tries to withdraw funds", async () => {
            // Minting NFTs
            await minterContract.connect(addr1).publicMint(TEST_MINT_AMOUNT, { value: TEST_MINT_PRICE });

            // Trying to withdraw funds (non owner)
            await expect(minterContract.connect(addr1).withdraw()).to.be.revertedWith(NOT_THE_OWNER_ERROR);
        });
    });
});
