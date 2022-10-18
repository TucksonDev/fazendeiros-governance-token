# Fazendeiros DAO Governance Token
Governance Token for Fazendeiros DAO

# Technical specifications
There are two (plus one) smartcontracts in this repository:
- Governance Token: A ERC-1155 for the token that will be used in all governance decisions of the DAO. A ERC-1155 is created so in the future, new token ids can be created for each of the funding rounds the DAO might open.
- Minting smartcontract: A smartcontract with all the minting logic.
- [EXTRA] Standalone governance token: This is a backup version of the initial ERC-1155 with all the minting logic inside. This contract is not deployed with the standard deploy script.

## Libraries used
- OpenZeppelin standard of ERC-1155 is used: https://docs.openzeppelin.com/contracts/4.x/erc1155

# Some more information
- All scripts are written in Typescript. Support libraries for Typescript are already in package.json

# CLI instructions
- `npm install` : To install all dependencies
- `npx hardhat compile` : To compile the contract
- `npx hardhat test ./tests/FazendeirosDAO.ts` : To run the tests
- `npx hardhat run ./scripts/deploy.ts --network [goerli|mainnet]` : To run the deploy script
- `npx hardhat verify <ContractAddress> --network [goerli|mainnet]` : To initiate the verification process for Etherscan

# Dependencies
- Libraries are specified in package.json
- Hardhat is used to compile, test and run scripts: https://hardhat.org/
- Alchemy is used for configuring the ETH node to go through: https://www.alchemy.com/
