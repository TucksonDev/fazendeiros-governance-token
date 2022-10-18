// Needed libraries
import { ethers } from "hardhat";

// Load dotenv configuration
import * as dotenv from "dotenv";
dotenv.config();

// Information needed
const TRANSACTION_HASH = "0xb9675db1607487e194be8f56cb46ccea1a6e4c2d52b26f6c6754b4ab3db80535";
const NEW_GAS_PRICE_IN_GWEI = 25;

async function main() {
    // Starting checks
    if (!process.env.GOERLI_PRIVATE_KEY) {
        throw new Error("Testnet private key not found on .env");
    }

    // Initialization
    const web3Provider = new ethers.providers.AlchemyProvider("goerli", process.env.ALCHEMY_GOERLI_KEY);
    const signer = new ethers.Wallet(process.env.GOERLI_PRIVATE_KEY);

    const currentTxn = await web3Provider.getTransaction(TRANSACTION_HASH);
    console.log("TRANSACTION FOUND");
    console.log("-----------------");
    console.log(currentTxn);

    const txnRequest = {
        to: currentTxn.to,
        from: currentTxn.from,
        nonce: currentTxn.nonce,
        data: currentTxn.data,
        value: currentTxn.value,
        gasLimit: currentTxn.gasLimit,
        gasPrice: ethers.utils.parseUnits(NEW_GAS_PRICE_IN_GWEI.toString(), "gwei"),
        chainId: currentTxn.chainId,
    };

    // Signing, sending and showing the result
    const signedTxn = await signer.signTransaction(txnRequest);
    const txnResult = await web3Provider.sendTransaction(signedTxn);
    console.log("TRANSACTION SENT");
    console.log("----------------");
    console.log(txnResult);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
