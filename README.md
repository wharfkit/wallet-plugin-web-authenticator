# Web Authenticator Wallet Plugin for Wharf

> ⚠️ **WARNING**: This project is currently under development and not ready for production use. Use at your own risk.

A wallet plugin for Wharf that allows signing transactions using a web-based authenticator service. This plugin opens a popup window to handle authentication and transaction signing through a web interface.

## Features

-   Web-based authentication flow
-   Popup window interface for secure interaction
-   Support for transaction signing
-   Currently only supports Jungle 4 testnet
-   Configurable web authenticator URL

## Installation

```bash
yarn add @wharfkit/wallet-plugin-web-authenticator
```

## Usage

```typescript
import { SessionKit } from '@wharfkit/session'
import { WalletPluginWebAuthenticator } from '@wharfkit/wallet-plugin-web-authenticator'

// Initialize the wallet plugin
const webAuthenticator = new WalletPluginWebAuthenticator({
    webAuthenticatorUrl: 'https://your-authenticator-url.com' // Optional, defaults to http://localhost:5174
})

// Create a new SessionKit instance with the plugin
const sessionKit = new SessionKit({
    appName: 'your-app',
    chains: [...],
    walletPlugins: [webAuthenticator]
})
```

## Configuration

The plugin accepts the following configuration options:

```typescript
interface WebAuthenticatorOptions {
    webAuthenticatorUrl?: string // The URL of your web authenticator service
}
```

## Web Authenticator Requirements

Your web authenticator service should implement the following endpoints:

-   `/sign` - Handles both login requests and transaction signing
    -   Query Parameters:
        -   `esr` - The encoded signing request
        -   `chain` - The chain name
        -   `accountName` - (Only for signing) The account name
        -   `permissionName` - (Only for signing) The permission name

The authenticator should respond by posting a message to the opener window with the following format:

For login:

```typescript
{
    payload: {
        cid: string // Chain ID
        sa: string // Signing account
        sp: string // Signing permission
        sig?: string // Optional: Signature proving ownership of the account for third-party verification
    }
}
```

For signing:

```typescript
{
    signatures: string[]  // Array of signatures
}
```

### Identity Proof

When logging in, the web authenticator can optionally provide a `sig` field in the response payload following the EOSIO Signing Request (ESR) standard. This signature proves ownership of the account and allows third-party applications to verify the authenticity of the login.

If provided, the wallet plugin will include an `identityProof` object in the login response:

```typescript
{
    identityProof: {
        signature: string, // The signature from the web authenticator
        signedRequest: string // The encoded identity request that was signed
    }
}
```

Third-party applications can use these values to verify that the user actually owns the account they claim to represent.

## Development

You need [Make](https://www.gnu.org/software/make/), [node.js](https://nodejs.org/en/) and [yarn](https://classic.yarnpkg.com/en/docs/install) installed.

1. Clone the repository
2. Install dependencies:
    ```bash
    yarn install
    ```
3. Build the project:
    ```bash
    make
    ```
4. Run tests:
    ```bash
    make test
    ```

See the [Makefile](./Makefile) for other useful targets. Before submitting a pull request make sure to run `make lint`.

## Security Considerations

-   The plugin verifies the origin of messages from the popup window against the configured authenticator URL
-   Popups must be enabled in the user's browser
-   The web authenticator service should implement appropriate security measures

## Limitations

-   Currently only supports the Jungle 4 testnet chain
-   Requires popup windows to be enabled in the browser
-   Web authenticator service must be available and properly configured

---

Made with ☕️ & ❤️ by [Greymass](https://greymass.com), if you find this useful please consider [supporting us](https://greymass.com/support-us).
