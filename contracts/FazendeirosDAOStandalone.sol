// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * FazendeirosDAO Governance Token contract (Standalone version)
 *
 * @author Tuckson
 * @title FazendeirosDAO Governance Token contract (Standalone version)
 */
contract FazendeirosDAOStandalone is ERC1155, Ownable {
    //
    ///////////////////////////////////
    // Constants and state variables //
    ///////////////////////////////////
    //

    // Data structures
    struct TokenIdInfo {
        // Collection information
        uint256 maxSupply;
        uint256 totalSupply;
        // Token Information
        string uri;
        // Editable tag
        bool canBeEdited;
        // Sale information
        uint256 price;
        uint8 maxMintAmountPerWallet;
    }

    // Tokens information
    mapping(uint256 => TokenIdInfo) private _tokenIdInfo;
    uint256 private _totalSupply;

    // Minting constants
    mapping(address => uint256) private _mintedTokens;

    //
    ///////////////
    // Modifiers //
    ///////////////
    //
    /**
     * @dev Throws if tokenId does not exist
     */
    modifier existingToken(uint256 tokenId) {
        require(_tokenIdInfo[tokenId].maxSupply != 0, "Token ID does not exist");
        _;
    }

    //
    /////////////////
    // Constructor //
    /////////////////
    //
    constructor() ERC1155("") {}

    //
    /////////////////////
    // Admin functions //
    /////////////////////
    //
    function createNewTokenId(
        uint256 tokenId,
        uint256 maxSupply,
        string memory tokenURI,
        uint256 price,
        uint8 maxMintAmountPerWallet
    ) public onlyOwner {
        require(_tokenIdInfo[tokenId].maxSupply == 0, "Token ID already exists");

        // Setting new information
        _tokenIdInfo[tokenId] = TokenIdInfo(maxSupply, 0, tokenURI, true, price, maxMintAmountPerWallet);
    }

    function setTokenIdInfo(
        uint256 tokenId,
        uint256 maxSupply,
        string memory tokenURI,
        uint256 price,
        uint8 maxMintAmountPerWallet
    ) public onlyOwner existingToken(tokenId) {
        require(_tokenIdInfo[tokenId].canBeEdited == true, "Token ID cannot be edited");

        // Getting current values
        uint256 tokenIdSupply = _tokenIdInfo[tokenId].totalSupply;
        bool tokenCanBeEdited = _tokenIdInfo[tokenId].canBeEdited;

        // Setting new information
        _tokenIdInfo[tokenId] = TokenIdInfo(
            maxSupply,
            tokenIdSupply,
            tokenURI,
            tokenCanBeEdited,
            price,
            maxMintAmountPerWallet
        );
    }

    function disableTokenEdition(uint256 tokenId) public onlyOwner existingToken(tokenId) {
        _tokenIdInfo[tokenId].canBeEdited = false;
    }

    //
    //////////////////////////////
    // Private helper functions //
    //////////////////////////////
    //
    function mint(uint256 tokenId, uint256 amount) internal {
        require(
            amount > 0 && amount <= _tokenIdInfo[tokenId].maxMintAmountPerWallet,
            string.concat(
                "Amount must be between 1 and ",
                Strings.toString(_tokenIdInfo[tokenId].maxMintAmountPerWallet)
            )
        );
        require(
            (_mintedTokens[_msgSender()] + amount) <= _tokenIdInfo[tokenId].maxMintAmountPerWallet,
            string.concat(
                "The amount to mint plus the current balance must be lower or equal to ",
                Strings.toString(_tokenIdInfo[tokenId].maxMintAmountPerWallet)
            )
        );
        require(
            msg.value >= (amount * _tokenIdInfo[tokenId].price),
            string.concat("Price per token should be ", Strings.toString(_tokenIdInfo[tokenId].price))
        );
        require(
            _tokenIdInfo[tokenId].totalSupply + amount <= _tokenIdInfo[tokenId].maxSupply,
            "No supply available to mint that amount"
        );

        // address to, uint256 id, uint256 amount, bytes memory data
        _mint(_msgSender(), tokenId, amount, "");

        // Adding supply
        _tokenIdInfo[tokenId].totalSupply += amount;
        _totalSupply += amount;

        // And minted tokens
        _mintedTokens[_msgSender()] += amount;
    }

    //
    /////////////
    // Getters //
    /////////////
    //
    function tokenInfo(uint256 tokenId) public view existingToken(tokenId) returns (TokenIdInfo memory) {
        return _tokenIdInfo[tokenId];
    }

    function tokenTotalSupply(uint256 tokenId) public view existingToken(tokenId) returns (uint256) {
        return _tokenIdInfo[tokenId].totalSupply;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {ERC1155-uri}.
     */
    function uri(uint256 tokenId) public view virtual override existingToken(tokenId) returns (string memory) {
        return _tokenIdInfo[tokenId].uri;
    }

    //
    ///////////////////////
    // Public operations //
    ///////////////////////
    //
    // Public minting
    function publicMint(uint256 tokenId, uint256 amount) public payable existingToken(tokenId) {
        mint(tokenId, amount);
    }
}
