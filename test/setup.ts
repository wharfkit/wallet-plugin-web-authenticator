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

// Mock buoy library
const mockBuoyResponses = new Map<string, any>()
const channelCounts = new Map<string, number>()

// Mock the buoy send function
const mockSend = async (message: any, options: any) => {
    // Store the message for the corresponding channel
    if (options.channel) {
        mockBuoyResponses.set(options.channel, message)
    }
    return 'delivered'
}

// Mock the buoy receive function
const mockReceive = async (options: any) => {
    const channel = options.channel

    // Wait a bit to simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Check if we have a stored response for this channel
    if (mockBuoyResponses.has(channel)) {
        const response = mockBuoyResponses.get(channel)
        mockBuoyResponses.delete(channel)
        return response
    }

    // Default response based on channel content
    // Handle both old format (wharf-web-auth-{type}-timestamp-random) and new format (PUB_K1_...)
    if (channel.includes('wharf-web-auth') || channel.startsWith('PUB_K1_')) {
        // Count how many times we've seen this channel
        const count = channelCounts.get(channel) || 0
        channelCounts.set(channel, count + 1)

        // Determine if this is a login request
        // For old format: check if channel contains 'identity'
        // For new format: treat first occurrence as login, second as sign
        // If this is a PUB_K1_ channel and it's not the first occurrence, treat it as sign
        const isLoginRequest = channel.includes('identity') || count === 0

        // Reset channel counts periodically to allow for multiple tests
        if (channelCounts.size > 10) {
            channelCounts.clear()
        }

        if (isLoginRequest) {
            // Login response
            return {
                type: 'wharf:login:response',
                payload: {
                    cid: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                    sa: 'wharfkit1131',
                    sp: 'test',
                    link_key: 'PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63',
                    sig: String(mockSignature),
                },
            }
        } else {
            // Sign response - use ESR callback format to ensure isCallback returns true
            return {
                payload: {
                    // ESR callback format that should make isCallback return true
                    tx: '01234567890123456789',
                    sig: String(mockSignature),
                    sig0: String(mockSignature),
                    sa: 'test',
                    sp: 'active',
                    rbn: '1234',
                    rid: '5678',
                    ex: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    req: 'mock-request-encoded',
                    cid: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                    callback: 'https://example.com/callback',
                },
            }
        }
    }

    throw new Error('No response available for channel: ' + channel)
}

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

// Mock the buoy module by replacing the module exports
const buoyModule = require('@greymass/buoy')
buoyModule.send = mockSend
buoyModule.receive = mockReceive

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
