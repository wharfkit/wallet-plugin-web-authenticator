import {createIdentityRequest} from '@wharfkit/protocol-esr'
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

            return {
                chain: Checksum256.from(response.chain),
                permissionLevel: PermissionLevel.from(response.permissionLevel),
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
        _context: TransactContext
    ): Promise<WalletPluginSignResponse> {
        try {
            const signUrl = `${this.webAuthenticatorUrl}/sign?esr=${encodeURIComponent(
                resolved.request.encode()
            )}`
            const response = await this.openPopup(signUrl)

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
