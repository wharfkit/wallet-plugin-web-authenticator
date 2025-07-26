import {
    createIdentityRequest,
    extractSignaturesFromCallback,
    isCallback,
    setTransactionCallback,
} from '@wharfkit/protocol-esr'
import {
    AbstractWalletPlugin,
    Checksum256,
    LoginContext,
    PermissionLevel,
    ResolvedSigningRequest,
    TransactContext,
    WalletPlugin,
    WalletPluginConfig,
    WalletPluginLoginResponse,
    WalletPluginMetadata,
    WalletPluginSignResponse,
} from '@wharfkit/session'
import {PrivateKey, PublicKey, UInt64} from '@wharfkit/antelope'
import {sealMessage} from './utils'

interface WebAuthenticatorOptions {
    /** The URL of the web authenticator service */
    webAuthenticatorUrl?: string
}

export class WalletPluginWebAuthenticator extends AbstractWalletPlugin implements WalletPlugin {
    private webAuthenticatorUrl: string

    constructor(options: WebAuthenticatorOptions = {}) {
        super()
        this.webAuthenticatorUrl = options.webAuthenticatorUrl || 'http://localhost:5174'
    }

    /**
     * The logic configuration for the wallet plugin.
     */
    readonly config: WalletPluginConfig = {
        // Allow chain selection since the web authenticator may support multiple chains
        requiresChainSelect: false,
        // Allow permission selection
        requiresPermissionSelect: false,
        // Currently only supports Jungle 4:
        supportedChains: ['73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d'],
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
    private async openPopup(url: string, type: 'sign' | 'identity' = 'sign'): Promise<any> {
        return new Promise((resolve, reject) => {
            const popup = window.open(url, 'Web Authenticator', 'width=400,height=600')

            if (!popup) {
                reject(new Error('Popup blocked - please enable popups for this site'))
                return
            }

            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed)
                    reject(
                        new Error(
                            type === 'sign' ? 'Transaction cancelled' : 'Authentication cancelled'
                        )
                    )
                }
            }, 1000)

            const baseUrlOrigin = new URL(this.webAuthenticatorUrl).origin
            const handler = (event: MessageEvent) => {
                // Verify origin matches our authenticator URL
                if (event.origin !== baseUrlOrigin) {
                    return
                }

                window.removeEventListener('message', handler)
                clearInterval(checkClosed)
                popup.close()
                resolve(event.data)
            }

            window.addEventListener('message', handler)
        })
    }

    /**
     * Performs login by opening the web authenticator in a popup
     */
    async login(context: LoginContext): Promise<WalletPluginLoginResponse> {
        try {
            // Generate a new request key pair for this login attempt
            this.data.privateKey = PrivateKey.generate('K1')
            const requestPublicKey = this.data.privateKey.toPublic()

            context.appName = context.appName || 'Unknown App'

            // Create the identity request to be presented to the user
            const {request} = await createIdentityRequest(context, '')

            const loginUrl = `${this.webAuthenticatorUrl}/sign?esr=${request.encode()}&chain=${
                context.chain?.id
            }&requestKey=${requestPublicKey.toString()}`
            const response = await this.openPopup(loginUrl, 'identity')

            const {payload} = response

            this.data.publicKey = payload.link_key

            return {
                chain: Checksum256.from(payload.cid),
                permissionLevel: PermissionLevel.from({
                    actor: payload.sa,
                    permission: payload.sp,
                }),
            }
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

            resolved.request.setBroadcast(false)
            setTransactionCallback(resolved.request, '')

            // Seal the request using the shared secret
            const nonce = UInt64.from(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))

            const sealedRequest = await sealMessage(
                resolved.request.encode(),
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

            const response = await this.openPopup(signUrl, 'sign')

            const wasSuccessful =
                isCallback(response.payload) &&
                extractSignaturesFromCallback(response.payload).length > 0

            if (wasSuccessful) {
                // If the callback was resolved, create a new request from the response
                const resolvedRequest = await ResolvedSigningRequest.fromPayload(
                    response.payload,
                    context.esrOptions
                )

                // Return the new request and the signatures from the wallet
                return {
                    signatures: extractSignaturesFromCallback(response.payload),
                    resolved: resolvedRequest,
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
