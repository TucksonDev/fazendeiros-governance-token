// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

/*
 #######                                                                     ######     #    ####### 
 #         ##   ###### ###### #    # #####  ###### # #####   ####   ####     #     #   # #   #     # 
 #        #  #      #  #      ##   # #    # #      # #    # #    # #         #     #  #   #  #     # 
 #####   #    #    #   #####  # #  # #    # #####  # #    # #    #  ####     #     # #     # #     # 
 #       ######   #    #      #  # # #    # #      # #####  #    #      #    #     # ####### #     # 
 #       #    #  #     #      #   ## #    # #      # #   #  #    # #    #    #     # #     # #     # 
 #       #    # ###### ###### #    # #####  ###### # #    #  ####   ####     ######  #     # #######
*/

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * FazendeirosDAO Governance Token contract
 *
 * @author Tuckson
 * @title FazendeirosDAO Governance Token contract
 */
contract FazendeirosDAO is ERC1155, Ownable {
    //
    /////////////////////
    // State variables //
    /////////////////////
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
    }

    // Token ids information
    mapping(uint256 => TokenIdInfo) private _tokenIdInfo;
    uint256 private _totalSupply;

    // Minting variables
    address private _minter;

    //
    ///////////////
    // Modifiers //
    ///////////////
    //
    /**
     * @dev Throws if tokenId has not been created
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
    /**
     * @dev Creates a new token id
     * @param tokenId token id to create
     * @param maxSupply maximum supply for token id
     * @param tokenURI metadata uri for token id
     *
     * Requirements:
     *
     * - `tokenId` must not have been created before
     * - can only be called by the owner of the contract
     */
    function createNewTokenId(
        uint256 tokenId,
        uint256 maxSupply,
        string memory tokenURI
    ) public onlyOwner {
        require(_tokenIdInfo[tokenId].maxSupply == 0, "Token ID already exists");

        _tokenIdInfo[tokenId] = TokenIdInfo(maxSupply, 0, tokenURI, true);
    }

    /**
     * @dev Changes the information of an existing new token id
     * @param tokenId token id to edit
     * @param maxSupply maximum supply for token id
     * @param tokenURI metadata uri for token id
     *
     * Requirements:
     *
     * - `tokenId` must have been created before
     * - can only be called by the owner of the contract
     */
    function setTokenIdInfo(
        uint256 tokenId,
        uint256 maxSupply,
        string memory tokenURI
    ) public onlyOwner existingToken(tokenId) {
        require(_tokenIdInfo[tokenId].canBeEdited == true, "Token ID cannot be edited");

        // Getting current values that will not change
        uint256 tokenIdSupply = _tokenIdInfo[tokenId].totalSupply;
        bool tokenCanBeEdited = _tokenIdInfo[tokenId].canBeEdited;

        // Setting new information
        _tokenIdInfo[tokenId] = TokenIdInfo(maxSupply, tokenIdSupply, tokenURI, tokenCanBeEdited);
    }

    /**
     * @dev Disables the ability to change the information of a token id
     * @param tokenId token id to disable
     *
     * Requirements:
     *
     * - `tokenId` must have been created before
     * - can only be called by the owner of the contract
     */
    function disableTokenEdition(uint256 tokenId) public onlyOwner existingToken(tokenId) {
        _tokenIdInfo[tokenId].canBeEdited = false;
    }

    /**
     * @dev Sets the address allowed to mint from this contract.
     *      Zero address is allowed in case we want to disable proxy minting
     * @param newMinter address of the contract or wallet allowed to mint
     */
    function setMinter(address newMinter) public onlyOwner {
        _minter = newMinter;
    }

    /**
     * @dev Mints a token to the specified `to` address
     * @param to address where to send the token
     * @param tokenId token id to mint
     * @param amount amount of tokens to mint
     *
     * Requirements:
     *
     * - `tokenId` must have been created before
     * - can only be called by the owner of the contract
     */
    function ownerMint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) public onlyOwner existingToken(tokenId) {
        mint(to, tokenId, amount);
    }

    //
    //////////////////////////////
    // Private helper functions //
    //////////////////////////////
    //
    /**
     * @dev Internal function to mint a token
     * @param to address where to send the token
     * @param tokenId token id to mint
     * @param amount amount of tokens to mint
     *
     * Requirements:
     *
     * - `amount` added to the totalSupply of that token id cannot be greater than the maxSupply for that token
     */
    function mint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) internal {
        require(
            _tokenIdInfo[tokenId].totalSupply + amount <= _tokenIdInfo[tokenId].maxSupply,
            "No supply available to mint that amount"
        );

        // address to, uint256 id, uint256 amount, bytes memory data
        _mint(to, tokenId, amount, "");

        // Adding supply
        _tokenIdInfo[tokenId].totalSupply += amount;
        _totalSupply += amount;
    }

    //
    /////////////
    // Getters //
    /////////////
    //
    /**
     * @dev Returns the information stored for a specific token id
     * @param tokenId token id to return the information for
     * @return TokenIdInfo information about the token id
     *
     * Requirements:
     *
     * - `tokenId` must have been created before
     */
    function tokenInfo(uint256 tokenId) public view existingToken(tokenId) returns (TokenIdInfo memory) {
        return _tokenIdInfo[tokenId];
    }

    /**
     * @dev Returns the current minted supply for a specific token id
     * @param tokenId token id to return the current supply for
     * @return uint256 current minted supply for token id
     *
     * Requirements:
     *
     * - `tokenId` must have been created before
     */
    function tokenTotalSupply(uint256 tokenId) public view existingToken(tokenId) returns (uint256) {
        return _tokenIdInfo[tokenId].totalSupply;
    }

    /**
     * @dev Returns the total minted supply of all tokens
     * @return uint256 current minted supply for all tokens
     */
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev Returns the current minter address
     * @return address current minter address
     */
    function minter() public view returns (address) {
        return _minter;
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
    /**
     * @dev Mints a token to the specified `to` address
     * @param to address where to send the token
     * @param tokenId token id to mint
     * @param amount amount of tokens to mint
     *
     * Requirements:
     *
     * - `tokenId` must have been created before
     * - can only be called by the specified minter
     */
    function proxiedMint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) public existingToken(tokenId) {
        require(_msgSender() == _minter, "Minting is restricted to the minter address");
        mint(to, tokenId, amount);
    }
}
