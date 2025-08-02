import {JSDOM} from 'jsdom'
import {TextDecoder, TextEncoder} from 'text-encoding'
import {mockSignature} from './tests/mocks'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable',
})

const window = dom.window as any
global.window = window
global.document = window.document

// Mock response storage for the new callback system
let totalRequestCount = 0

// Mock the getMockResponse method by extending the WalletPluginWebAuthenticator class
// This will be set up after the class is loaded

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
    }

    // Simulate popup closing after a delay
    setTimeout(() => {
        mockPopup.close()
    }, 150)

    return mockPopup
}

// Set up mock responses for the WalletPluginWebAuthenticator
// This will be done after the class is loaded in the test files

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
// Mock navigator object
Object.defineProperty(global, 'navigator', {
    value: {
        userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        platform: 'MacIntel',
        language: 'en-US',
        languages: ['en-US', 'en'],
        cookieEnabled: true,
        onLine: true,
        geolocation: {},
        mediaDevices: {},
        permissions: {
            query: () => Promise.resolve({state: 'granted'}),
        },
    },
    writable: true,
    configurable: true,
})
