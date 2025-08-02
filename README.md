# Web Authenticator Wallet Plugin for Wharf

> ⚠️ **WARNING**: This project is currently under development and not ready for production use. Use at your own risk.

A wallet plugin for Wharf that allows signing transactions using a web-based authenticator service. This plugin opens a popup window to handle authentication and transaction signing through a web interface using the [@greymass/buoy](https://www.npmjs.com/package/@greymass/buoy) messaging system.

## Features

-   Web-based authentication flow
-   Popup window interface for secure interaction
-   Support for transaction signing
-   Currently only supports Jungle 4 testnet
-   Configurable web authenticator URL
-   Uses buoy messaging system for secure communication between popup and parent window
-   Sealed message encryption for enhanced security

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
    webAuthenticatorUrl: 'https://your-authenticator-url.com', // Optional, defaults to http://localhost:5174
    buoyServiceUrl: 'https://cb.anchor.link' // Optional, defaults to https://cb.anchor.link
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
    buoyServiceUrl?: string // The URL of the buoy messaging service
}
```

## Web Authenticator Requirements

Your web authenticator service should implement the following endpoints:

-   `/sign` - Handles both login requests and transaction signing
    -   Query Parameters:
        -   `type` - The type of request: `login` or `sign`
        -   `esr` - (For login) The encoded identity request
        -   `sealed` - (For signing) The sealed (encrypted) signing request
        -   `nonce` - (For signing) The nonce used for sealing the request
        -   `chain` - The chain ID
        -   `requestKey` - The public key for the request
        -   `buoyChannel` - The buoy channel ID for messaging
        -   `accountName` - (Only for signing) The account name
        -   `permissionName` - (Only for signing) The permission name
        -   `appName` - (Only for signing) The app name

The authenticator should respond by sending a message through the buoy channel with the following format:

For login:

```typescript
{
    type: 'wharf:login:response',
    payload: {
        cid: string // Chain ID
        sa: string // Signing account
        sp: string // Signing permission
        link_key: string // Public key for the link
        sig?: string // Optional: Signature proving ownership of the account for third-party verification
    }
}
```

**Note**: The web authenticator should return `type: 'wharf:login:response'` for login requests, not `type: 'sign_response'`.

For signing:

```typescript
{
    payload: {
        signatures: string[]  // Array of signatures
        // Or alternatively, individual signature fields:
        sig: string // Signature
        sig0: string // Alternative signature field
        tx: string // Transaction ID
        sa: string // Signer authority
        sp: string // Signer permission
        rbn: string // Reference block num
        rid: string // Reference block ID
        ex: string // Expiration
        req: string // Original request
        cid: string // Chain ID
    }
}
```

### Buoy Messaging

This plugin uses the [@greymass/buoy](https://www.npmjs.com/package/@greymass/buoy) library for secure messaging between the popup window and the parent window. The buoy system provides:

-   **Secure Communication**: Messages are sent through a trusted buoy service
-   **Channel-based Messaging**: Each request gets a unique channel ID
-   **Timeout Handling**: Built-in timeout and error handling
-   **Cross-origin Support**: Works across different domains

### Sealed Messages

All requests are sealed (encrypted) before being sent to the web authenticator service using the `@wharfkit/sealed-messages` library. This provides:

-   **End-to-end Encryption**: Messages are encrypted between the plugin and authenticator
-   **Request Integrity**: Ensures messages cannot be tampered with
-   **Nonce-based Security**: Each request uses a unique nonce for additional security

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

## User Interface Integration

The plugin integrates with the Wharf SessionKit UI system to provide user feedback:

-   **Status Messages**: When a popup is opened, the plugin displays a status message informing the user to complete the action in the popup window
-   **Retry Mechanism**: If popup windows fail to open, the plugin provides an "Open Wallet" button for users to retry
-   **UI Context**: The plugin uses the UI context from the SessionKit to display appropriate messages and handle user interactions

### Retry Functionality

When popup windows fail to open (due to browser blocking or other issues), the plugin:

1. Shows a status message directing the user to click the "Open Wallet" button
2. Provides a retry function that can be called by the UI
3. Allows users to manually trigger another popup attempt without showing error messages

## Security Considerations

-   The plugin uses buoy messaging for secure communication between popup and parent window
-   All requests are sealed (encrypted) before transmission
-   Popups must be enabled in the user's browser
-   The web authenticator service should implement appropriate security measures
-   The buoy service should be trusted and properly configured

## Limitations

-   Currently only supports the Jungle 4 testnet chain
-   Requires popup windows to be enabled in the browser
-   Web authenticator service must be available and properly configured
-   Requires a buoy service for messaging (defaults to https://cb.anchor.link)

---

Made with ☕️ & ❤️ by [Greymass](https://greymass.com), if you find this useful please consider [supporting us](https://greymass.com/support-us).
