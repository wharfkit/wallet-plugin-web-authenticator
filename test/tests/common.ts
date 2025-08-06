import {Chains, SessionKit} from '@wharfkit/session'
import {PermissionLevel, Signature, APIClient, PrivateKey} from '@wharfkit/antelope'
import {
    mockChainDefinition,
    mockPermissionLevel,
    mockPrivateKey,
    mockSessionKitArgs,
    mockSessionKitOptions,
} from '@wharfkit/mock-data'
import {assert} from 'chai'
import {
    LoginContext,
    ResolvedSigningRequest,
    TransactContext,
    ChainDefinition,
    ABICacheInterface,
    WalletPluginSignResponse,
    UserInterface,
    Cancelable,
    PromptArgs,
    PromptResponse,
    TransactHooks,
    LoginHooks,
    UserInterfaceLoginResponse,
    UserInterfaceAccountCreationResponse,
    CreateAccountContext,
} from '@wharfkit/session'

import {WalletPluginWebAuthenticator} from '$lib'
import {
    makeMockResolvedSigningRequest,
    makeMockSigningRequest,
    mockPublicKey,
    mockSignature,
    transferAbi,
} from './mocks'

// Mock the waitForCallback function by overriding the module
const originalWaitForCallback = require('@wharfkit/protocol-esr').waitForCallback
const originalCreateIdentityRequest = require('@wharfkit/protocol-esr').createIdentityRequest
const originalExtractSignaturesFromCallback =
    require('@wharfkit/protocol-esr').extractSignaturesFromCallback
const originalIsCallback = require('@wharfkit/protocol-esr').isCallback
const originalSetTransactionCallback = require('@wharfkit/protocol-esr').setTransactionCallback

// Mock responses
const mockLoginResponse = {
    cid: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
    sa: 'wharfkit1131',
    sp: 'test',
    link_key: 'PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63',
    sig: 'SIG_K1_KBub1qmdiPpWA2XKKEZEG3PLZPMP3FnYJuH4gYrKzAQKdxYnJjFMpVWdxEwmFFodgGaNnAMbR4kaFkuXBtJnZLCYWWJdqp',
}

const mockSignResponse = {
    tx: '01234567890123456789',
    sig: 'SIG_K1_mock_signature_for_testing',
    sa: 'wharfkit1131',
    sp: 'test',
    rbn: '1234',
    rid: '5678',
    ex: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    req: 'mock-request-encoded',
    cid: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
    callback: 'https://example.com/callback',
}

suite('wallet plugin', function () {
    // Common setup
    const chainId = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d'
    const chain = ChainDefinition.from({
        id: chainId,
        url: 'https://jungle4.greymass.com',
    })

    // Mock UI component
    const mockUI = {
        status() {
            return Promise.resolve()
        },
        prompt(args: PromptArgs): Cancelable<PromptResponse> {
            const promise = Promise.resolve({value: 'test'} as PromptResponse)
            return Object.assign(promise, {
                cancel: (reason?: string, silent?: boolean): Cancelable<PromptResponse> => {
                    return Object.assign(Promise.resolve({value: ''} as PromptResponse), {
                        cancel: () => promise as Cancelable<PromptResponse>,
                    })
                },
            })
        },
        onLogin() {
            return Promise.resolve()
        },
        onLoginComplete() {
            return Promise.resolve()
        },
        onTransact() {
            return Promise.resolve()
        },
        onTransactComplete() {
            return Promise.resolve()
        },
        onBroadcast() {
            return Promise.resolve()
        },
        onBroadcastComplete() {
            return Promise.resolve()
        },
        onSign() {
            return Promise.resolve()
        },
        onSignComplete() {
            return Promise.resolve()
        },
        onAccountCreate() {
            return Promise.resolve()
        },
        onAccountCreateComplete() {
            return Promise.resolve()
        },
        onError() {
            return Promise.resolve()
        },
        translate(key: string) {
            return key
        },
        addTranslations() {},
        getTranslate() {
            return (key: string) => key
        },
    }

    // Mock window setup
    let originalWindow: any
    let mockPopup: any

    setup(function () {
        // Store original window
        originalWindow = global.window

        // Create mock popup
        mockPopup = {
            closed: false,
            close: () => {
                mockPopup.closed = true
            },
        }

        // Mock window methods and properties
        const windowSpy = {
            open: () => mockPopup,
            addEventListener: () => {},
            removeEventListener: () => {},
        }

        // Apply mocks to window object
        Object.assign(global.window, windowSpy)

        // Mock the protocol-esr functions
        const protocolEsr = require('@wharfkit/protocol-esr')
        protocolEsr.waitForCallback = async () => mockLoginResponse
        protocolEsr.createIdentityRequest = async () => ({
            callback: {id: 'mock-callback-id'},
            request: {encode: () => 'mock-request'},
            requestKey: 'mock-request-key',
            privateKey: 'mock-private-key',
        })
        protocolEsr.extractSignaturesFromCallback = () => [mockSignature]
        protocolEsr.isCallback = () => true
        protocolEsr.setTransactionCallback = () => ({id: 'mock-transaction-callback'})
    })

    teardown(function () {
        global.window = originalWindow

        // Restore original functions
        const protocolEsr = require('@wharfkit/protocol-esr')
        protocolEsr.waitForCallback = originalWaitForCallback
        protocolEsr.createIdentityRequest = originalCreateIdentityRequest
        protocolEsr.extractSignaturesFromCallback = originalExtractSignaturesFromCallback
        protocolEsr.isCallback = originalIsCallback
        protocolEsr.setTransactionCallback = originalSetTransactionCallback
    })

    test('login functionality', async function () {
        const plugin = new WalletPluginWebAuthenticator({
            webAuthenticatorUrl: 'https://web-authenticator.greymass.com',
        })

        // Mock login context
        const loginContext = {
            chain,
            chains: [chain],
            fetch: global.fetch,
            hooks: {},
            permissionLevel: PermissionLevel.from('wharfkit1131@test'),
            ui: mockUI,
            walletPlugins: [],
            arbitrary: {},
            uiRequirements: {},
            addHook: () => {},
            getClient: () => new APIClient({url: chain.url}),
            esrOptions: {},
        } as unknown as LoginContext

        // Test login functionality
        const loginResponse = await plugin.login(loginContext)

        // Verify login response
        assert.equal(loginResponse.chain.toString(), chainId)
        assert.equal(loginResponse.permissionLevel.actor.toString(), 'wharfkit1131')
        assert.equal(loginResponse.permissionLevel.permission.toString(), 'test')

        // Verify identity proof is included for third-party verification
        assert.exists((loginResponse as any).identityProof, 'Identity proof should be included')
        assert.exists(
            (loginResponse as any).identityProof.signature,
            'Identity proof signature should be included'
        )
        assert.exists(
            (loginResponse as any).identityProof.signedRequest,
            'Identity proof signed request should be included'
        )
        assert.equal(
            (loginResponse as any).identityProof.signature,
            'SIG_K1_KBub1qmdiPpWA2XKKEZEG3PLZPMP3FnYJuH4gYrKzAQKdxYnJjFMpVWdxEwmFFodgGaNnAMbR4kaFkuXBtJnZLCYWWJdqp'
        )
    })

    test('sign functionality', async function () {
        const plugin = new WalletPluginWebAuthenticator({
            webAuthenticatorUrl: 'https://web-authenticator.greymass.com',
        })

        // Use different keys for the sign test to avoid channel ID conflicts
        const signPrivateKey = PrivateKey.generate('K1')
        const signPublicKey = signPrivateKey.toPublic()
        plugin.data.privateKey = signPrivateKey
        plugin.data.publicKey = signPublicKey

        const mockResolvedSigningRequest = await makeMockResolvedSigningRequest()

        // Test sign functionality
        const signResponse = await plugin.sign(mockResolvedSigningRequest, {
            chain: Chains.Jungle4,
            ui: mockUI,
            fetch: global.fetch,
            hooks: {},
            walletPlugins: [],
            arbitrary: {},
            uiRequirements: {},
            addHook: () => {},
            getClient: () => new APIClient({url: chain.url}),
            createRequest: async ({transaction}) => ({
                setInfoKey: () => {},
                encode: () => 'mock-encoded-request',
            }),
            esrOptions: {
                abiProvider: {
                    getAbi: async (account) => {
                        if (account.toString() === 'eosio.token') {
                            return transferAbi
                        }
                        throw new Error(`No ABI for ${account}`)
                    },
                },
            },
        } as unknown as TransactContext)

        // Verify sign response
        assert.isTrue(signResponse.signatures.length === 1)
        assert.instanceOf(signResponse.signatures[0], Signature)
        assert.exists(signResponse.resolved)
    })

    test('popup success with UI feedback', async function () {
        const plugin = new WalletPluginWebAuthenticator({
            webAuthenticatorUrl: 'https://web-authenticator.greymass.com',
        })

        // Mock login context with UI
        const loginContext = {
            chain,
            chains: [chain],
            fetch: global.fetch,
            hooks: {},
            permissionLevel: PermissionLevel.from('wharfkit1131@test'),
            ui: mockUI,
            walletPlugins: [],
            arbitrary: {},
            uiRequirements: {},
            addHook: () => {},
            getClient: () => new APIClient({url: chain.url}),
            esrOptions: {},
        } as unknown as LoginContext

        // Test login functionality
        const loginResponse = await plugin.login(loginContext)

        // Verify login response
        assert.equal(loginResponse.chain.toString(), chainId)
        assert.equal(loginResponse.permissionLevel.actor.toString(), 'wharfkit1131')
        assert.equal(loginResponse.permissionLevel.permission.toString(), 'test')
    })
})
