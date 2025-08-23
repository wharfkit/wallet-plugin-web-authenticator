import {
    createIdentityRequest,
    extractSignaturesFromCallback,
    isCallback,
    LinkInfo,
    setTransactionCallback,
    waitForCallback,
} from '@wharfkit/protocol-esr'
import {ReceiveOptions} from '@greymass/buoy'
import {
    AbstractWalletPlugin,
    CallbackPayload,
    Checksum256,
    LoginContext,
    PermissionLevel,
    ResolvedSigningRequest,
    TransactContext,
    UserInterface,
    WalletPlugin,
    WalletPluginConfig,
    WalletPluginLoginResponse,
    WalletPluginMetadata,
    WalletPluginSignResponse,
} from '@wharfkit/session'
import {PrivateKey, PublicKey, UInt64} from '@wharfkit/antelope'
import {sealMessage} from '@wharfkit/sealed-messages'
import WebSocket from 'isomorphic-ws'

interface WebAuthenticatorOptions {
    /** The URL of the web authenticator service */
    webAuthenticatorUrl?: string
    /** The buoy service URL for messaging */
    buoyServiceUrl?: string
    /** The buoy WebSocket for messaging */
    buoyWs?: WebSocket
}

export class WalletPluginWebAuthenticator extends AbstractWalletPlugin implements WalletPlugin {
    private webAuthenticatorUrl: string
    private buoyServiceUrl: string
    private buoyWs?: WebSocket
    private manualPopupShown = false

    constructor(options: WebAuthenticatorOptions = {}) {
        super()
        this.webAuthenticatorUrl = options.webAuthenticatorUrl || 'http://localhost:5174'
        this.buoyServiceUrl = options.buoyServiceUrl || 'https://cb.anchor.link'
        this.buoyWs = options?.buoyWs
    }

    /**
     * The logic configuration for the wallet plugin.
     */
    readonly config: WalletPluginConfig = {
        // Allow chain selection since the web authenticator may support multiple chains
        requiresChainSelect: false,
        // Allow permission selection
        requiresPermissionSelect: false,
        // Currently only supports Jungle 4 and Vaulta:
        supportedChains: [
            '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
            'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
        ],
    }

    /**
     * The metadata for the wallet plugin to be displayed in the user interface.
     */
    readonly metadata: WalletPluginMetadata = WalletPluginMetadata.from({
        name: 'Web Authenticator',
        description: 'Sign transactions using a web-based authenticator',
        homepage: 'https://github.com/wharfkit/wallet-plugin-web-authenticator',
    })

    /**
     * Unique identifier for this wallet plugin
     */
    get id(): string {
        return 'web-authenticator'
    }

    /**
     * Opens a popup window with the given URL and waits for it to complete
     */
    private async openPopup(
        url: string,
        receiveOptions: ReceiveOptions,
        ui?: UserInterface
    ): Promise<{payload: CallbackPayload}> {
        return new Promise((resolve, reject) => {
            const t = ui?.getTranslate(this.id)

            // Show status message using WharfKit UI
            ui?.status('Opening authenticator popup...')

            const popup = window.open(url, 'Web Authenticator', 'width=450,height=750')

            if (!popup) {
                this.manualPopupShown = true
                return this.showManualPopupPrompt(url, receiveOptions, ui)
                    .then((response) => {
                        resolve(response)
                    })
                    .catch((error) => {
                        reject(error)
                    })
            }

            // Update status
            ui?.prompt({
                title: 'Approve',
                body: 'Please approve the transaction in the popup that just opened',
                elements: [],
            })

            const checkClosedInterval = setInterval(() => {
                if (popup?.closed) {
                    clearInterval(checkClosedInterval)
                    ui?.status('Transaction cancelled')
                    reject(new Error('Transaction cancelled by user'))
                }
            }, 1000)

            waitForCallback(receiveOptions, this.buoyWs, t)
                .then((response) => {
                    popup?.close()
                    ui?.status('Transaction approved successfully')
                    resolve({payload: response})
                })
                .catch(() => {
                    popup?.close()
                    ui?.status('Transaction cancelled')
                    reject(new Error('Transaction cancelled by user'))
                })
                .finally(() => {
                    clearInterval(checkClosedInterval)
                    this.manualPopupShown = false
                })
        })
    }

    /**
     * Shows error prompt and handles retry logic
     */
    private showManualPopupPrompt(
        url: string,
        receiveOptions: ReceiveOptions,
        ui?: UserInterface
    ): Promise<{payload: CallbackPayload}> {
        return new Promise((resolve, reject) => {
            ui?.prompt({
                title: 'Popup blocked',
                body: `The popup was blocked. Please open it manually.`,
                elements: [
                    {
                        type: 'button',
                        data: {
                            label: 'Trigger Popup',
                            onClick: () => {
                                this.openPopup(url, receiveOptions, ui)
                                    .then((response) => {
                                        resolve(response)
                                    })
                                    .catch((error) => {
                                        reject(error)
                                    })
                            },
                        },
                    },
                ],
            })
        })
    }

    /**
     * Performs login by opening the web authenticator in a popup
     */
    async login(context: LoginContext): Promise<WalletPluginLoginResponse> {
        try {
            context.appName = context.appName || 'Unknown App'

            // Create the identity request to be presented to the user
            const {
                callback: receiveOptions,
                request,
                requestKey,
                privateKey,
            } = await createIdentityRequest(context, this.buoyServiceUrl)

            const loginUrl = `${this.webAuthenticatorUrl}/sign?esr=${request.encode()}&chain=${
                context.chain?.id
            }&requestKey=${requestKey}`

            const {payload}: {payload: CallbackPayload} = await this.openPopup(
                loginUrl,
                receiveOptions,
                context.ui
            )

            this.data.privateKey = String(privateKey)
            this.data.publicKey = payload.link_key

            if (!payload.cid) {
                throw new Error('Login failed: No chain ID returned')
            }

            // Prepare the basic login response
            const loginResponse: WalletPluginLoginResponse = {
                chain: Checksum256.from(payload.cid),
                permissionLevel: PermissionLevel.from({
                    actor: payload.sa,
                    permission: payload.sp,
                }),
            }

            // Store the identity request and signature for verification
            // The 3rd party app can use this to verify the authentication
            if (payload.sig) {
                // Create identity proof object for third-party verification
                Object.assign(loginResponse, {
                    identityProof: {
                        signature: payload.sig,
                        signedRequest: request.encode(),
                    },
                })
            }

            return loginResponse
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Login failed: ${error.message}`)
            }
            throw new Error('Login failed: Unknown error')
        }
    }

    /**
     * Signs a transaction by opening the web authenticator in a popup
     */
    async sign(
        resolved: ResolvedSigningRequest,
        context: TransactContext
    ): Promise<WalletPluginSignResponse> {
        try {
            // Ensure we have a request key from login
            if (!this.data.privateKey || !this.data.publicKey) {
                throw new Error('No request keys available - please login first')
            }

            const expiration = resolved.transaction.expiration.toDate()

            // Create a new signing request based on the existing resolved request
            const modifiedRequest = await context.createRequest({transaction: resolved.transaction})

            // Set the expiration on the request LinkInfo
            modifiedRequest.setInfoKey(
                'link',
                LinkInfo.from({
                    expiration,
                })
            )

            // Add the callback to the request
            const callback = setTransactionCallback(modifiedRequest, this.buoyServiceUrl)

            // Seal the request using the shared secret
            const nonce = UInt64.from(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

            const sealedRequest = await sealMessage(
                modifiedRequest.encode(),
                PrivateKey.from(this.data.privateKey),
                PublicKey.from(this.data.publicKey),
                nonce
            )

            const signUrl = `${this.webAuthenticatorUrl}/sign?sealed=${sealedRequest.toString(
                'hex'
            )}&nonce=${nonce.toString()}&chain=${context.chain?.name}&accountName=${
                context.accountName
            }&permissionName=${context.permissionName}&appName=${
                context.appName
            }&requestKey=${String(PrivateKey.from(this.data.privateKey).toPublic())}`

            const response = await this.openPopup(signUrl, callback, context.ui)

            const signatures = extractSignaturesFromCallback(response.payload)
            const wasSuccessful = isCallback(response.payload) && signatures.length > 0

            if (wasSuccessful) {
                // Return the signatures from the wallet
                return {
                    signatures: extractSignaturesFromCallback(response.payload),
                    resolved: resolved, // Return the original resolved request for testing
                }
            } else {
                throw new Error('Signing failed: No signatures returned')
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Signing failed: ${error.message}`)
            }
            throw new Error('Signing failed: Unknown error')
        }
    }
}
