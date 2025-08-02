declare global {
    interface Window {
        manualPopupTrigger?: {
            /**
             * Manually opens the authenticator popup when popups are blocked
             * This method is created by the Web Authenticator plugin when popup blocking is detected
             */
            openPopup(): void
        }
    }
}

export {}
