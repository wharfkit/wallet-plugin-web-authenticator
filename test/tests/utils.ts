import {assert} from 'chai'
import {PrivateKey, UInt64} from '@wharfkit/antelope'
import {sealMessage, unsealMessage} from '@wharfkit/sealed-messages'

suite('utils', function () {
    test('sealMessage', async function () {
        const privateKey = PrivateKey.generate('K1')
        const publicKey = privateKey.toPublic()
        const nonce = UInt64.from(1234567890)
        const message = 'Hello, World!'

        const sealedMessage = await sealMessage(message, privateKey, publicKey, nonce)
        assert.notEqual(sealedMessage.toString('hex'), message)
        assert.isTrue(sealedMessage.length > 0)
        assert.match(sealedMessage.toString('hex'), /^[0-9a-f]+$/)
        assert.equal(sealedMessage.length % 16, 0)
    })

    test('unsealMessage', async function () {
        const privateKey = PrivateKey.generate('K1')
        const publicKey = privateKey.toPublic()
        const nonce = UInt64.from(1234567890)
        const message = 'Hello, World!'

        const sealedMessage = await sealMessage(message, privateKey, publicKey, nonce)
        const unsealedMessage = await unsealMessage(sealedMessage, privateKey, publicKey, nonce)
        assert.equal(unsealedMessage, message)
    })
})
