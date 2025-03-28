import {
    ABI,
    Action,
    Asset,
    Name,
    PermissionLevel,
    PrivateKey,
    Struct,
    Transaction,
} from '@wharfkit/antelope'
import {Chains} from '@wharfkit/common'
import {mockPrivateKey as mockPrivateKeyString} from '@wharfkit/mock-data'
import {ResolvedSigningRequest, SigningRequest, type AbiMap} from '@wharfkit/signing-request'

export const mockEmail = 'test@example.com'

export const mockPrivateKey = PrivateKey.from(mockPrivateKeyString)
export const mockPublicKey = mockPrivateKey.toPublic()

@Struct.type('transfer')
export class Transfer extends Struct {
    @Struct.field('name') from!: Name
    @Struct.field('name') to!: Name
    @Struct.field('asset') quantity!: Asset
    @Struct.field('string') memo!: string
}

export const mockPermissionLevel = PermissionLevel.from({actor: 'test', permission: 'active'})

export const transferAbi = ABI.from({
    version: 'eosio::abi/1.0',
    types: [],
    structs: [
        {
            name: 'transfer',
            base: '',
            fields: [
                {name: 'from', type: 'name'},
                {name: 'to', type: 'name'},
                {name: 'quantity', type: 'asset'},
                {name: 'memo', type: 'string'},
            ],
        },
    ],
    actions: [{name: 'transfer', type: 'transfer', ricardian_contract: ''}],
})

// Create transfer action
export const mockTransferAction = Action.from({
    account: 'eosio.token',
    name: 'transfer',
    authorization: [mockPermissionLevel],
    data: Transfer.from({
        from: 'myaccount',
        to: 'otheraccount',
        quantity: '1.0000 EOS',
        memo: 'test',
    }),
})

export const mockTransaction = Transaction.from({
    ref_block_num: 1234,
    ref_block_prefix: 5678,
    expiration: new Date(Date.now() + 60 * 60 * 1000),
    actions: [mockTransferAction],
})

export const makeMockSigningRequest = async () => {
    // Create a transaction with proper TaPoS values
    const transaction = Transaction.from({
        expiration: new Date(Date.now() + 60 * 60 * 1000),
        ref_block_num: 1234,
        ref_block_prefix: 5678,
        max_net_usage_words: 0,
        max_cpu_usage_ms: 0,
        delay_sec: 0,
        actions: [mockTransferAction],
    })

    // Create request with the transaction
    return SigningRequest.create({
        transaction,
        chainId: Chains.Jungle4.id,
    })
}

export async function makeMockResolvedSigningRequest(): Promise<ResolvedSigningRequest> {
    const mockSigningRequest = await makeMockSigningRequest()
    const abis: AbiMap = new Map<string, ABI>()
    abis.set('eosio.token', transferAbi)
    return mockSigningRequest.resolve(abis, mockPermissionLevel)
}

export const mockSignature = mockPrivateKey.signDigest(
    mockTransaction.signingDigest(Chains.Jungle4.id)
)
