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
    Signature,
    TransactContext,
    WalletPlugin,
    WalletPluginConfig,
    WalletPluginLoginResponse,
    WalletPluginMetadata,
    WalletPluginSignResponse,
} from '@wharfkit/session'

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
    private async openPopup(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const popup = window.open(url, 'Web Authenticator', 'width=800,height=600')

            if (!popup) {
                reject(new Error('Popup blocked - please enable popups for this site'))
                return
            }

            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed)
                    reject(new Error('Authentication cancelled'))
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
            // Create the identity request to be presented to the user
            const {request} = await createIdentityRequest(context, '')
            const loginUrl = `${this.webAuthenticatorUrl}/sign?esr=${request.encode()}&chain=${
                context.chain?.name
            }`
            const response = await this.openPopup(loginUrl)

            const {payload} = response

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
            // Create a new signing request based on the existing resolved request
            const modifiedRequest = await context.createRequest({transaction: resolved.transaction})
            setTransactionCallback(modifiedRequest, '')
            const signUrl = `${this.webAuthenticatorUrl}/sign?esr=${encodeURIComponent(
                modifiedRequest.encode()
            )}&chain=${context.chain?.name}&accountName=${context.accountName}&permissionName=${
                context.permissionName
            }`
            const response = await this.openPopup(signUrl)

            console.log('response', response)

            const wasSuccessful =
                isCallback(response.payload) &&
                extractSignaturesFromCallback(response.payload).length > 0

            console.log('wasSuccessful', wasSuccessful)
            console.log('isCallback', isCallback(response.payload))
            console.log(
                'extractSignaturesFromCallback',
                extractSignaturesFromCallback(response.payload)
            )

            if (wasSuccessful) {
                // If the callback was resolved, create a new request from the response
                const resolvedRequest = await ResolvedSigningRequest.fromPayload(
                    response.payload,
                    context.esrOptions
                )

                console.log('resolvedRequest', resolvedRequest)

                // Return the new request and the signatures from the wallet
                return {
                    signatures: extractSignaturesFromCallback(response.payload),
                    resolved: resolvedRequest,
                }
            } else {
                throw new Error('Signing failed: No signatures returned')
            }

            return {
                signatures: response.signatures.map((sig: string) => Signature.from(sig)),
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Signing failed: ${error.message}`)
            }
            throw new Error('Signing failed: Unknown error')
        }
    }
}
