// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

////////////////////////////////////////
// Interface for FazendeirosDAO Token //
////////////////////////////////////////
/**
 * @dev Interface for FazendeirosDAO Token
 *      See {FazendeirosDAO}.
 */
interface TokenContractInterface {
    function proxiedMint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) external;
}

/**
 * FazendeirosDAO Token Minter contract
 *
 * @author Tuckson
 * @title FazendeirosDAO Token Minter contract
 */
contract FazendeirosDAOMinter is Ownable, ReentrancyGuard {
    //
    ///////////////////////////////////
    // Constants and state variables //
    ///////////////////////////////////
    //

    // Token variables
    TokenContractInterface private _tokenContract;
    address private _tokenContractAddress;
    uint256 private _tokenId;

    // Sale variables
    enum SaleState {
        Off,
        Presale,
        Public
    } // [0 - Off, 1 - Presale, 2 - Public]
    SaleState private _saleState = SaleState.Off;
    uint256 private _tokenPrice = 100 ether;
    uint8 private _maxMintAmountPerWallet = 1;
    mapping(address => uint256) private _mintedTokens;

    // Whitelisting
    bytes32 private _merkleRoot = 0x0;

    //
    /////////////////
    // Constructor //
    /////////////////
    //
    // Constructor - Sets the token contract address
    constructor(address newTokenContractAddress) {
        _tokenContractAddress = newTokenContractAddress;
        _tokenContract = TokenContractInterface(_tokenContractAddress);
    }

    //
    //////////////////////////////
    // Private helper functions //
    //////////////////////////////
    //
    /**
     * @dev Mints an amount of tokens
     * @param amount of tokens to mint
     *
     * Requirements:
     *
     * - `amount` must be between 1 and the specified maximum amount per wallet
     * - `amount` added to the tokens already minted by the caller cannot be greater than the specified maximum amount per wallet
     * - Paid amount must be equal or greater than the specified price per token multiplied by the amount to mint
     */
    function mint(uint8 amount) internal {
        require(
            amount > 0 && amount <= _maxMintAmountPerWallet,
            string.concat("Amount must be between 1 and ", Strings.toString(_maxMintAmountPerWallet))
        );
        require(
            (_mintedTokens[_msgSender()] + amount) <= _maxMintAmountPerWallet,
            string.concat(
                "The amount to mint plus the current balance must be lower or equal to ",
                Strings.toString(_maxMintAmountPerWallet)
            )
        );
        require(
            msg.value >= (amount * _tokenPrice),
            string.concat("Price per token should be ", Strings.toString(_tokenPrice))
        );

        // Calling the token contract to mint
        _tokenContract.proxiedMint(_msgSender(), _tokenId, amount);

        // Adding up the tokens minted by the caller
        _mintedTokens[_msgSender()] += amount;
    }

    //
    /////////////////////
    // Admin functions //
    /////////////////////
    //
    /**
     * @dev Withdraws the ether received by the minters
     *
     * Requirements:
     *
     * - can only be called by the owner of the contract
     */
    function withdraw() public onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    //
    /////////////
    // Setters //
    /////////////
    //
    /**
     * @dev Sets the address where the token contract is located
     * @param newTokenContractAddress address of the token contract
     *
     * Requirements:
     *
     * - `newTokenContractAddress` cannot be the zero address
     * - can only be called by the owner of the contract
     */
    function setTokenContractAddress(address newTokenContractAddress) public onlyOwner {
        require(newTokenContractAddress != address(0), "Zero address cannot be the token contract address");
        _tokenContractAddress = newTokenContractAddress;
        _tokenContract = TokenContractInterface(_tokenContractAddress);
    }

    /**
     * @dev Sets the tokenId to mint
     * @param newTokenId token id to mint from the token contract
     *
     * Requirements:
     *
     * - can only be called by the owner of the contract
     */
    function setTokenInformation(uint256 newTokenId) public onlyOwner {
        _tokenId = newTokenId;
    }

    /**
     * @dev Sets the information for the sale
     * @param newTokenPrice price to mint
     * @param newMaxMintAmountPerWallet maximum amount of tokens a wallet is able to mint
     *
     * Requirements:
     *
     * - can only be called by the owner of the contract
     */
    function setSaleInformation(uint256 newTokenPrice, uint8 newMaxMintAmountPerWallet) public onlyOwner {
        _tokenPrice = newTokenPrice;
        _maxMintAmountPerWallet = newMaxMintAmountPerWallet;
    }

    /**
     * @dev Sets the state of the sale
     * @param newSaleState changes the state of the sale
     *
     * Requirements:
     *
     * - can only be called by the owner of the contract
     */
    function setSaleState(SaleState newSaleState) public onlyOwner {
        _saleState = newSaleState;
    }

    /**
     * @dev Sets the merkle root for the private sale
     * @param merkleRoot hash of the merkle root of the whitelisted addresses
     *
     * Requirements:
     *
     * - can only be called by the owner of the contract
     */
    function setMerkleRoot(bytes32 merkleRoot) public onlyOwner {
        _merkleRoot = merkleRoot;
    }

    //
    /////////////
    // Getters //
    /////////////
    //
    /**
     * @dev Returns the address of the token contract
     * @return address of the token contract
     */
    function tokenContractAddress() public view returns (address) {
        return _tokenContractAddress;
    }

    /**
     * @dev Returns the token id set to be minted
     * @return uint256 token id to be minted in the token contract
     */
    function tokenId() public view returns (uint256) {
        return _tokenId;
    }

    /**
     * @dev Returns the current state of the sale
     * @return SaleState current state of the sale
     */
    function saleState() public view returns (SaleState) {
        return _saleState;
    }

    /**
     * @dev Returns the price set to mint
     * @return uint256 current price
     */
    function tokenPrice() public view returns (uint256) {
        return _tokenPrice;
    }

    /**
     * @dev Returns the maximum amount per wallet set
     * @return uint8 current maximum amount per wallet
     */
    function maxMintAmountPerWallet() public view returns (uint8) {
        return _maxMintAmountPerWallet;
    }

    //
    ///////////////////////
    // Public operations //
    ///////////////////////
    //

    /**
     * @dev Mints a token
     * @param amount amount of tokens to mint
     * @param merkleProof proof that the caller is whitelisted
     *
     * Requirements:
     *
     * - _saleState must be in Presale
     * - caller of the function must be whitelisted
     */
    function presaleMint(uint8 amount, bytes32[] calldata merkleProof) public payable nonReentrant {
        require(_saleState == SaleState.Presale, "Presale is not active");
        bytes32 leaf = keccak256(abi.encodePacked(_msgSender()));
        require(MerkleProof.verify(merkleProof, _merkleRoot, leaf), "Address is not whitelisted");
        mint(amount);
    }

    /**
     * @dev Mints a token
     * @param amount amount of tokens to mint
     *
     * Requirements:
     *
     * - _saleState must be in Public
     */
    function publicMint(uint8 amount) public payable nonReentrant {
        require(_saleState == SaleState.Public, "Public sale is not active");
        mint(amount);
    }
}
