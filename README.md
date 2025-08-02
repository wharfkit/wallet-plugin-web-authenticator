# Web Authenticator Wallet Plugin for Wharf

> ⚠️ **WARNING**: This project is currently under development and not ready for production use. Use at your own risk.

A wallet plugin for Wharf that allows signing transactions using a web-based authenticator service. This plugin opens a popup window to handle authentication and transaction signing through a web interface.

## Features

-   Web-based authentication flow
-   Popup window interface for secure interaction
-   Support for transaction signing
-   Currently only supports Jungle 4 testnet
-   Configurable web authenticator URL
-   **Enhanced UI feedback** with status messages
-   **Manual popup trigger** when popups are blocked
-   **Error handling** for popup failures

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

## UI Integration

The plugin provides enhanced UI feedback through WharfKit's UserInterface:

### Status Messages

-   "Opening authenticator popup..."
-   "Please approve the transaction in the popup that just opened"
-   "Transaction approved successfully"
-   "Transaction cancelled"
-   "Transaction failed"
-   "Popup blocked - please enable popups for this site"

### Error Handling & Retry

The plugin includes comprehensive error handling with automatic retry options:

-   **Automatic Error Detection** - Any error in the popup process triggers a UI prompt
-   **Single Prompt Limit** - The UI prompt is only shown once per operation to avoid spam
-   **Static Counter** - Uses a static counter that resets to 0 when the operation completes successfully
-   **Recursive Retry** - The retry button calls `this.openPopup()` recursively
-   **Timeout Protection** - 30-second timeout for user interaction
-   **Clear Error Messages** - Descriptive error messages for different failure types

### UI Integration

The plugin uses WharfKit's built-in UI prompt system for error handling:

```typescript
// When any error occurs, the plugin automatically shows:
ui?.prompt({
    title: 'Open Popup',
    body: 'The popup was blocked. Please open it manually.',
    elements: [{type: 'button', label: 'Open Popup', data: 'open'}],
})
```

The retry button recursively calls `this.openPopup()`. The static counter ensures the prompt is only shown once per operation and resets when the operation completes successfully.

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
        sa: string // Account name
        sp: string // Permission name
        link_key: string // Public key
        sig: string // Signature
    }
}
```

For signing:

```typescript
{
    payload: {
        tx: string // Transaction ID
        sig: string // Signature
        sa: string // Account name
        sp: string // Permission name
        rbn: string // Reference block number
        rid: string // Reference block ID
        ex: string // Expiration
        req: string // Request
        cid: string // Chain ID
        callback: string // Callback URL
    }
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
