// js/utils.js - Utility functions

const Utils = {
    // --- Show a global notification message ---
    showMessage: function (messageKeyOrText, type = 'info') {
        // Ensure the message container exists
        let messageContainer = document.getElementById('globalMessageContainer');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'globalMessageContainer';
            messageContainer.className = 'global-message-container';
            document.body.appendChild(messageContainer);
        }

        // Create the message element
        const messageEl = document.createElement('div');
        messageEl.className = `global-message ${type}`;

        // Check if messageKeyOrText corresponds to a data-i18n key or is plain text/html
        // A simple heuristic: if it contains a dot or equals a known key, treat as key
        // Otherwise, treat as direct HTML/text.
        // This relies on your translation keys being structured (e.g., "module.key").
        let messageContent = messageKeyOrText;
        if (typeof I18nModule !== 'undefined' &&
            typeof I18nModule.applyTranslations === 'function' &&
            (messageKeyOrText.includes('.') || I18nModule.translations?.[window.currentLanguage]?.[messageKeyOrText])) {
            // Treat as a translation key
            messageEl.setAttribute('data-i18n', messageKeyOrText);
            // Apply translation if module is ready
            // Note: If translations aren't loaded yet, this might not work immediately.
            // A more robust system might queue messages until ready.
            I18nModule.applyTranslations(messageEl);
        } else {
            // Treat as direct HTML/text
            // Sanitize if necessary, though innerHTML is used intentionally here for flexibility
            messageEl.innerHTML = messageKeyOrText;
        }

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'message-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => {
            messageContainer.removeChild(messageEl);
            // Remove container if empty
            if (messageContainer.children.length === 0) {
                messageContainer.remove();
            }
        };
        messageEl.appendChild(closeBtn);

        // Add to container
        messageContainer.appendChild(messageEl);

        // Auto-remove after a delay (e.g., 5 seconds)
        setTimeout(() => {
            if (messageEl.parentNode === messageContainer) {
                messageContainer.removeChild(messageEl);
                if (messageContainer.children.length === 0) {
                    messageContainer.remove();
                }
            }
        }, 5000); // 5 seconds
    },

    // --- Show Validation Error Popup (specifically for voting validation) ---
    showValidationError: function (messageKey) {
        const popup = document.getElementById('validationPopup');
        const messageEl = document.getElementById('validationMessage');
        if (popup && messageEl) {
            // Set the message content using data-i18n for translation
            messageEl.setAttribute('data-i18n', messageKey);
            // Apply translation
            if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                I18nModule.applyTranslations(messageEl);
            }
            popup.classList.remove('hidden');
            // Auto-hide validation popup after a short delay
            setTimeout(() => {
                popup.classList.add('hidden');
            }, 3000); // 3 seconds
        } else {
            console.warn('Validation popup elements not found. Fallback to global notification.');
            this.showMessage(messageKey, 'error');
        }
    },

    // --- Sort Candidates Utility ---
    sortCandidates: function (candidatesArray, criteria) {
        return candidatesArray.sort((a, b) => {
            switch (criteria) {
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'activity-desc':
                    if (b.activity !== a.activity) {
                        return b.activity - a.activity;
                    }
                    // Secondary sort by name if activity is equal
                    return a.name.localeCompare(b.name);
                case 'activity-asc':
                    if (a.activity !== b.activity) {
                        return a.activity - b.activity;
                    }
                    // Secondary sort by name if activity is equal
                    return a.name.localeCompare(b.name);
                default:
                    return 0;
            }
        });
    }
};

// Expose globally
window.Utils = Utils;
