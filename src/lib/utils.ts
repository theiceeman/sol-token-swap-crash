
import * as web3 from "@solana/web3.js";

export function generateKeyPair() {
    const keypair = web3.Keypair.generate();
    return keypair;
}
/**
 * Sending transactions.
 * @param signers 
 * @param transaction 
 */
export async function _sendTransaction(connection:web3.Connection, signers: Array<any>, transaction: any) {
    const transactionSignature = await web3.sendAndConfirmTransaction(connection, transaction, signers);
    console.log("\n", `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`);
    return;
}