import {Bytes, Checksum512, PrivateKey, PublicKey, Serializer, UInt64} from '@wharfkit/antelope'

/**
 * Seals a message using AES encryption and a shared secret derived from given keys.
 * @param message - The message to seal
 * @param privateKey - The private key to use for encryption
 * @param publicKey - The public key to use for encryption
 * @param nonce - A nonce to use for encryption
 * @returns The sealed message as Bytes
 */
export async function sealMessage(
    message: string,
    privateKey: PrivateKey,
    publicKey: PublicKey,
    nonce: UInt64
): Promise<Bytes> {
    const secret = privateKey.sharedSecret(publicKey)
    const key = Checksum512.hash(Serializer.encode({object: nonce}).appending(secret.array))
    const symmetricKey = await crypto.subtle.importKey(
        'raw',
        key.array.slice(0, 32),
        {name: 'AES-CBC'},
        false,
        ['encrypt', 'decrypt']
    )
    const encryptedMessage = await crypto.subtle.encrypt(
        {name: 'AES-CBC', iv: key.array.slice(32, 48)},
        symmetricKey,
        Bytes.from(message, 'utf8').array
    )
    return Bytes.from(encryptedMessage)
}

/**
 * Decrypt a message using AES and shared secret derived from given keys.
 * @param message - The encrypted message bytes to decrypt
 * @param privateKey - The private key to use for deriving the shared secret
 * @param publicKey - The public key to use for deriving the shared secret
 * @param nonce - The nonce used in the encryption process
 * @returns The decrypted message as a UTF-8 string
 * @internal
 */
export async function unsealMessage(
    message: Bytes,
    privateKey: PrivateKey,
    publicKey: PublicKey,
    nonce: UInt64
): Promise<string> {
    const secret = privateKey.sharedSecret(publicKey)
    const key = Checksum512.hash(Serializer.encode({object: nonce}).appending(secret.array))
    const symmetricKey = await crypto.subtle.importKey(
        'raw',
        key.array.slice(0, 32),
        {name: 'AES-CBC'},
        false,
        ['encrypt', 'decrypt']
    )
    const decryptedMessage = await crypto.subtle.decrypt(
        {name: 'AES-CBC', iv: key.array.slice(32, 48)},
        symmetricKey,
        message.array
    )
    return Bytes.from(decryptedMessage).toString('utf8')
}
