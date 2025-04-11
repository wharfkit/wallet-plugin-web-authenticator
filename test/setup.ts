import {JSDOM} from 'jsdom'
import {TextDecoder, TextEncoder} from 'text-encoding'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable',
})

const window = dom.window as any
global.window = window
global.document = window.document

// Mock window.open
window.open = function (url, name, features) {
    const mockPopup = {
        closed: false,
        close: function () {
            this.closed = true
        },
        document: {
            write: function () {},
            close: function () {},
        },
        location: {
            href: url,
            search: url && url.includes('?') ? url.split('?')[1] : '',
        },
        postMessage: function (message: any) {
            if (
                message &&
                (message.type === 'wharf:login:response' ||
                    message.type === 'wharf:transact:response')
            ) {
                // Simulate successful callback from web authenticator
                const callbackEvent = new window.CustomEvent('message', {
                    data: {
                        ...message,
                        payload: {
                            ...message.payload,
                            signatures: [
                                'SIG_K1_KBub1qmdiPpWA2XKKEZEG3PLZPMP3FnYJuH4gYrKzAQKdxYnJjFMpVWdxEwmFFodgGaNnAMbR4kaFkuXBtJnZLCYWWJdqp',
                            ],
                        },
                    },
                })

                // This is mocked to allow the event to be processed
                setTimeout(() => {
                    window.dispatchEvent(callbackEvent)
                    mockPopup.close()
                }, 50)
            }
        },
    }

    // Simulate response for login and sign requests
    setTimeout(() => {
        if (url.includes('web-authenticator')) {
            // Detect if it's a login or sign request
            const isLoginRequest = url.includes('login') || !url.includes('sign')

            const responseType = isLoginRequest ? 'wharf:login:response' : 'wharf:transact:response'

            // Create payload based on request type
            const payload = isLoginRequest
                ? {
                      chain: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                      permissionLevel: 'wharfkit1131@test',
                      signatures: [
                          'SIG_K1_KBub1qmdiPpWA2XKKEZEG3PLZPMP3FnYJuH4gYrKzAQKdxYnJjFMpVWdxEwmFFodgGaNnAMbR4kaFkuXBtJnZLCYWWJdqp',
                      ],
                  }
                : {
                      signatures: [
                          'SIG_K1_KBub1qmdiPpWA2XKKEZEG3PLZPMP3FnYJuH4gYrKzAQKdxYnJjFMpVWdxEwmFFodgGaNnAMbR4kaFkuXBtJnZLCYWWJdqp',
                      ],
                  }

            const event = new window.CustomEvent('message', {
                data: {
                    type: responseType,
                    payload,
                },
            })

            window.dispatchEvent(event)
            mockPopup.close()
        }
    }, 100)

    return mockPopup
}

// Add browser globals
global.HTMLCanvasElement = window.HTMLCanvasElement
global.HTMLVideoElement = window.HTMLVideoElement
global.Image = window.Image
global.Audio = window.Audio
global.File = window.File
global.FileReader = window.FileReader
global.Blob = window.Blob
global.URL = window.URL
global.WebSocket = window.WebSocket
global.XMLHttpRequest = window.XMLHttpRequest
global.FormData = window.FormData
global.DOMParser = window.DOMParser
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
