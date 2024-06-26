import { CLMM_PROGRAM_ID, DEVNET_PROGRAM_ID, OPEN_BOOK_PROGRAM, RAYMint, Raydium, TxVersion, USDCMint, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import Decimal from 'decimal.js'
import BN from 'bn.js'
import bs58 from 'bs58'
import dotenv from "dotenv"
import dayjs from 'dayjs'
dotenv.config()

const OWNER_PUB_KEY = process.env.OWNER_PUB_KEY;
const OWNER_PRV_KEY = process.env.OWNER_PRV_KEY;
const CLUSTER: 'devnet' | 'mainnet-beta' = 'devnet';
const CLUSTER_URL = process.env.RPC_URL ?? clusterApiUrl(CLUSTER);
const connection = new Connection(CLUSTER_URL, "single");
const txVersion = TxVersion.V0

if (!OWNER_PRV_KEY) throw new Error('No prv key!');
const ownerKeyPair: Keypair = Keypair.fromSecretKey(bs58.decode(OWNER_PRV_KEY))


const initRaydium = async () => {

    let raydium = await Raydium.load({
        connection,
        cluster: CLUSTER == 'devnet' ? 'devnet' : 'mainnet',
        owner: ownerKeyPair,
        disableFeatureCheck: true,
        disableLoadToken: true,
        blockhashCommitment: 'finalized',
    })
    // console.log({ xx: raydium.token })

    raydium.account.updateTokenAccount(await fetchTokenAccountData())
    connection.onAccountChange(ownerKeyPair.publicKey, async () => {
        raydium!.account.updateTokenAccount(await fetchTokenAccountData())
    })

    return raydium;
}
// initRaydium()
const fetchTokenAccountData = async () => {
    const solAccountResp = await connection.getAccountInfo(ownerKeyPair.publicKey)
    const tokenAccountResp = await connection.getTokenAccountsByOwner(ownerKeyPair.publicKey, { programId: TOKEN_PROGRAM_ID })
    const token2022Req = await connection.getTokenAccountsByOwner(ownerKeyPair.publicKey, { programId: TOKEN_2022_PROGRAM_ID })
    const tokenAccountData = parseTokenAccountResp({
        owner: ownerKeyPair.publicKey,
        solAccountResp,
        tokenAccountResp: {
            context: tokenAccountResp.context,
            value: [...tokenAccountResp.value, ...token2022Req.value],
        },
    })
    console.log({ xxx: tokenAccountData.tokenAccounts[0] })
    return tokenAccountData
}


const createPool = async () => {
    try {
        if (!OWNER_PUB_KEY) throw new Error('No pub key!');

        const raydium = await initRaydium()

        // you can call sdk api to get mint info or paste mint info from api: https://api-v3.raydium.io/mint/list
        const mint1 = await raydium.token.getTokenInfo('CuKjdwbWLeTCVASfqzFCe4MavdhdHpx7Lx3oJfQhbGS5')
        const mint2 = await raydium.token.getTokenInfo('5UNpg5XxmTf1P6tLiCuN1zuz4y5Pim3hTvCt6wTHNzeo')
        const clmmConfigs = await raydium.api.getClmmConfigs()
        return;
        const { execute } = await raydium.clmm.createPool({
            programId: CLUSTER == "devnet" ? DEVNET_PROGRAM_ID.CLMM : CLMM_PROGRAM_ID,
            mint1,
            mint2,
            ammConfig: { ...clmmConfigs[0], id: new PublicKey(clmmConfigs[0].id), fundOwner: '' },
            initialPrice: new Decimal(1),
            startTime: new BN(dayjs().add(1, 'h').valueOf()),
            txVersion,
            // optional: set up priority fee here
            // computeBudgetConfig: {
            //   units: 600000,
            //   microLamports: 100000000,
            // },
        })
        // console.log({ xx: execute }); return;
        const { txId } = await execute()
        console.log('clmm pool created:', { txId })
    } catch (error: any) {
        console.error(error)
        throw new Error(error)
    }
}
createPool()

export const createMarket = async () => {
    try {
        const raydium = await initRaydium()

        const RAYMint = await new PublicKey('CuKjdwbWLeTCVASfqzFCe4MavdhdHpx7Lx3oJfQhbGS5')
        const USDCMint = await new PublicKey('5UNpg5XxmTf1P6tLiCuN1zuz4y5Pim3hTvCt6wTHNzeo')

        const { execute, extInfo, transactions } = await raydium.marketV2.create({
            baseInfo: {
                mint: RAYMint,
                decimals: 6,
            },
            quoteInfo: {
                mint: USDCMint,
                decimals: 9,
            },
            lotSize: 1,
            tickSize: 0.01,
            dexProgramId: CLUSTER == "devnet" ? DEVNET_PROGRAM_ID.OPENBOOK_MARKET : OPEN_BOOK_PROGRAM,
            // dexProgramId: DEVNET_PROGRAM_ID.OPENBOOK_MARKET, // devnet
            txVersion,
            // optional: set up priority fee here
            // computeBudgetConfig: {
            //   units: 600000,
            //   microLamports: 100000000,
            // },
        })

        console.log(
            `create market total ${transactions.length} txs, market info: `,
            Object.keys(extInfo.address).reduce(
                (acc, cur) => ({
                    ...acc,
                    [cur]: extInfo.address[cur as keyof typeof extInfo.address].toBase58(),
                }),
                {}
            )
        )

        const txIds = await execute({
            // set sequentially to true means tx will be sent when previous one confirmed
            sequentially: true,
        })

        console.log('create market txIds:', txIds)
    } catch (error: any) {
        console.error(error)
        throw new Error(error)
    }
}
// createMarket()