import {
    approve,
    createMint,
    createAccount,
    createApproveInstruction,
    createInitializeAccountInstruction,
    getAccount,
    getMint,
    getMinimumBalanceForRentExemptAccount,
    mintTo,
    AccountLayout,
    TOKEN_PROGRAM_ID,
    ACCOUNT_SIZE,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { Connection, Keypair, clusterApiUrl, SystemProgram, PublicKey, TransactionInstruction, Transaction } from '@solana/web3.js';
import { _sendTransaction, generateKeyPair } from './lib/utils';
import { CurveType, TOKEN_SWAP_PROGRAM_ID, TokenSwap, TokenSwapLayout } from '@solana/spl-token-swap';
import bs58 from 'bs58'
import dotenv from "dotenv"
dotenv.config()

const OWNER_PUB_KEY = process.env.OWNER_PUB_KEY;
const OWNER_PRV_KEY = process.env.OWNER_PRV_KEY;
const CLUSTER: 'devnet' | 'mainnet' = 'devnet';
const CLUSTER_URL = process.env.RPC_URL ?? clusterApiUrl(CLUSTER);
const connection = new Connection(CLUSTER_URL, "single");

// https://web.archive.org/web/20221020152717/soldev.app/course/token-swap

const getTokenAcctCreationInstruction = async (tokenMint: PublicKey, swapAuthority: PublicKey, payer: PublicKey): Promise<[PublicKey, TransactionInstruction]> => {
    let tokenAccountAddress = await getAssociatedTokenAddress(
        tokenMint, // mint
        swapAuthority, // owner
        true // allow owner off curve
    )

    const tokenAccountInstruction = await createAssociatedTokenAccountInstruction(
        payer, // payer
        tokenAccountAddress, // ata
        swapAuthority, // owner
        tokenMint // mint
    )
    return [tokenAccountAddress, tokenAccountInstruction]
}


const createPool = async () => {
    if (!OWNER_PRV_KEY) throw new Error('No prv key!');

    const transaction = new Transaction()
    const ownerKeyPair: Keypair = Keypair.fromSecretKey(bs58.decode(OWNER_PRV_KEY))
    const tokenSwapStateAccount = generateKeyPair()
    const poolAccountRent = await TokenSwap.getMinBalanceRentForExemptTokenSwap(connection)

    // instruction to create the Token Swap State Account
    const tokenSwapStateAccountCreationInstruction = SystemProgram.createAccount({
        fromPubkey: ownerKeyPair.publicKey,
        newAccountPubkey: tokenSwapStateAccount.publicKey,
        space: TokenSwapLayout.span,
        lamports: poolAccountRent,
        programId: TOKEN_SWAP_PROGRAM_ID,
    });
    transaction.add(tokenSwapStateAccountCreationInstruction)


    // derive swap pool authority; account used to sign for transactions on behalf of the swap program.
    const [swapAuthority, bump] = await PublicKey.findProgramAddressSync(
        [tokenSwapStateAccount.publicKey.toBuffer()],
        TOKEN_SWAP_PROGRAM_ID,
    )
    console.log({ swapAuthority: swapAuthority.toBase58() })

    const TokenAMint = await new PublicKey('CuKjdwbWLeTCVASfqzFCe4MavdhdHpx7Lx3oJfQhbGS5')  // JOHN
    const TokenBMint = await new PublicKey('5UNpg5XxmTf1P6tLiCuN1zuz4y5Pim3hTvCt6wTHNzeo')  //

    // Create associated token accounts used for the actual swap pool
    let tokenAAccountAddress = await getAssociatedTokenAddress(
        TokenAMint,
        swapAuthority,
        true
    )

    const tokenAAccountInstruction = await createAssociatedTokenAccountInstruction(
        ownerKeyPair.publicKey,
        tokenAAccountAddress,
        swapAuthority,
        TokenAMint
    )
    transaction.add(tokenAAccountInstruction)
    let signers = [ownerKeyPair, tokenSwapStateAccount];
    await _sendTransaction(connection, signers, transaction); return;

    // Create associated token accounts used for the actual swap pool
    let tokenBAccountAddress = await getAssociatedTokenAddress(
        TokenBMint,
        swapAuthority,
        true
    )

    const tokenBAccountInstruction = await createAssociatedTokenAccountInstruction(
        ownerKeyPair.publicKey,
        tokenBAccountAddress,
        swapAuthority,
        TokenBMint
    )
    transaction.add(tokenBAccountInstruction)

    const [tokenATokenAcct, tokenACreationInstruction] = await getTokenAcctCreationInstruction(TokenAMint, swapAuthority, ownerKeyPair.publicKey)
    const [tokenBTokenAcct, tokenBCreationInstruction] = await getTokenAcctCreationInstruction(TokenBMint, swapAuthority, ownerKeyPair.publicKey)

    transaction.add(tokenACreationInstruction, tokenBCreationInstruction)


    // To mint the LP-tokens that represent an LP’s ownership in the pool.
    const poolTokenMint = await createMint(connection, ownerKeyPair, swapAuthority, null, 2);

    const tokenAccountPool = generateKeyPair()
    const rent = await getMinimumBalanceForRentExemptAccount(connection)
    const createTokenAccountPoolInstruction = SystemProgram.createAccount({
        fromPubkey: ownerKeyPair.publicKey,
        newAccountPubkey: tokenAccountPool.publicKey,
        space: ACCOUNT_SIZE,
        lamports: rent,
        programId: TOKEN_PROGRAM_ID,
    })
    const initializeTokenAccountPoolInstruction = createInitializeAccountInstruction(
        tokenAccountPool.publicKey,
        poolTokenMint,
        ownerKeyPair.publicKey
    )

    const feeOwner = new PublicKey('HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN')
    const [tokenFeeAcctAddress, tokenFeeAcctCreationInstruction] = await getTokenAcctCreationInstruction(poolTokenMint, feeOwner, ownerKeyPair.publicKey)





    const tokenSwapInitSwapInstruction = TokenSwap.createInitSwapInstruction(
        tokenSwapStateAccount,
        swapAuthority,
        tokenATokenAcct,
        tokenBTokenAcct,
        tokenAccountPool.publicKey,
        tokenFeeAcctAddress,
        tokenAccountPool.publicKey,
        TOKEN_PROGRAM_ID,
        TOKEN_SWAP_PROGRAM_ID,
        BigInt(0), BigInt(100), BigInt(5), BigInt(10000), BigInt(0), BigInt(100), BigInt(1), BigInt(100), CurveType.ConstantProduct
    )

    // let signers = [ownerKeyPair, tokenSwapStateAccount];
    // const transaction = new Transaction().add(

    // )

}
createPool()
