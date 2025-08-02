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
    let messageHandler: ((event: MessageEvent) => void) | undefined

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
            addEventListener: (event: string, handler: any) => {
                if (event === 'message') {
                    messageHandler = handler
                }
            },
            removeEventListener: () => {},
        }

        // Apply mocks to window object
        Object.assign(global.window, windowSpy)
    })

    teardown(function () {
        global.window = originalWindow
        messageHandler = undefined
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

        // Start the login process
        const loginPromise = plugin.login(loginContext)

        // Simulate the popup response
        setTimeout(() => {
            if (messageHandler) {
                messageHandler(
                    new MessageEvent('message', {
                        origin: 'https://web-authenticator.greymass.com',
                        data: {
                            type: 'identity',
                            payload: {
                                cid: chainId,
                                sa: 'wharfkit1131',
                                sp: 'test',
                                requestKey:
                                    'PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63',
                                // Include identity signature for verification using ESR standard field name
                                sig: 'SIG_K1_KBub1qmdiPpWA2XKKEZEG3PLZPMP3FnYJuH4gYrKzAQKdxYnJjFMpVWdxEwmFFodgGaNnAMbR4kaFkuXBtJnZLCYWWJdqp',
                            },
                        },
                    })
                )
            }
        }, 100)

        // Test login functionality
        const loginResponse = await loginPromise

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
        assert.equal((loginResponse as any).identityProof.signature, String(mockSignature))
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

        // Start the sign process
        const signPromise = plugin.sign(mockResolvedSigningRequest, {
            chain: Chains.Jungle4,
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
        } as TransactContext)

        // Test sign functionality
        const signResponse = await signPromise

        // Verify sign response
        assert.isTrue(signResponse.signatures.length === 1)
        assert.instanceOf(signResponse.signatures[0], Signature)
        assert.exists(signResponse.resolved)
    })

    test('popup retry functionality', async function () {
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

        // Mock window.open to return null (simulating popup failed to open)
        const originalOpen = window.open
        window.open = () => null

        try {
            // Attempt login - should fail due to popup failed to open
            await plugin.login(loginContext)
            assert.fail('Login should have failed due to popup failed to open')
        } catch (error: unknown) {
            assert.instanceOf(error, Error)
            if (error instanceof Error) {
                assert.include(error.message, 'Popup failed to open')
            }

            // Verify that retry function is available
            assert.exists((loginContext as any).retryPopup)
            assert.isFunction((loginContext as any).retryPopup)
        } finally {
            // Restore original window.open
            window.open = originalOpen
        }
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

        // Start the login process
        const loginPromise = plugin.login(loginContext)

        // Test login functionality
        const loginResponse = await loginPromise

        // Verify login response
        assert.equal(loginResponse.chain.toString(), chainId)
        assert.equal(loginResponse.permissionLevel.actor.toString(), 'wharfkit1131')
        assert.equal(loginResponse.permissionLevel.permission.toString(), 'test')
    })
})
