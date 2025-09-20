const I18nModule = {
    translations: {},
    currentLanguage: 'en',

    // Fetch Translations
    fetchTranslations: async function() {
        try {
            const response = await fetch('/api/translations');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.translations = await response.json();
            console.log("Translations fetched from backend:", this.translations);
        } catch (error) {
            console.error("Failed to fetch translations from backend:", error);
            this.translations = { en: {}, ar: {} }; // Fallback
        }
    },

    // Initialize i18n module
    initialize: async function() {
        await this.fetchTranslations();
        // Set initial language based on browser or stored preference
        const storedLang = localStorage.getItem('language');
        if (storedLang && this.translations[storedLang]) {
            this.currentLanguage = storedLang;
        }
        this.applyTranslations();
    },

    // Switch Language
    switchLanguage: function(lang) {
        if (lang && this.translations && typeof this.translations === 'object' && this.translations[lang]) {
            this.currentLanguage = lang;
            localStorage.setItem('language', lang);
            this.applyTranslations();

            const langSwitcher = document.getElementById('languageSwitcher');
            if (langSwitcher) {
                const buttonText = this.currentLanguage === 'en' ? 'عربي' : 'English';
                langSwitcher.textContent = buttonText;
                langSwitcher.setAttribute('data-lang', this.currentLanguage);
            }

            document.body.classList.toggle('rtl', this.currentLanguage === 'ar');
        } else {
            console.warn(`Cannot switch to language '${lang}'. It's not available in the loaded translations.`);
        }
    },

    // Apply Translations
    applyTranslations: function(container = document) {
        if (!this.translations[this.currentLanguage]) {
            console.warn(`Translations for language '${this.currentLanguage}' are not loaded.`);
            return;
        }
        
        const elementsToTranslate = container.querySelectorAll('[data-i18n]');
        elementsToTranslate.forEach(element => {
            const fullKey = element.getAttribute('data-i18n');
            const parts = fullKey.split('|');
            const key = parts[0];
            const attr = parts[1] || 'textContent';

            const translation = this.translations[this.currentLanguage][key];
            if (translation !== undefined && translation !== null) {
                if (element.dataset.i18nParams) {
                    try {
                        const params = JSON.parse(element.dataset.i18nParams);
                        let translatedText = translation;
                        for (const [paramKey, paramValue] of Object.entries(params)) {
                            translatedText = translatedText.replace(new RegExp(`{${paramKey}}`, 'g'), paramValue);
                        }
                        if (attr === 'textContent') {
                            element.textContent = translatedText;
                        } else {
                            element.setAttribute(attr, translatedText);
                        }
                    } catch (e) {
                        console.error("Error parsing i18n params for key:", key, e);
                        if (attr === 'textContent') {
                            element.textContent = translation;
                        } else {
                            element.setAttribute(attr, translation);
                        }
                    }
                } else {
                    if (attr === 'textContent') {
                        element.textContent = translation;
                    } else {
                        element.setAttribute(attr, translation);
                    }
                }
            } else {
                if (key) {
                    console.warn(`Translation key '${key}' not found for language '${this.currentLanguage}'`);
                }
            }
        });
        this.updateSortingOptions();
    },

    // Update Sorting Options
    updateSortingOptions: function() {
        if (!this.translations[this.currentLanguage]) return;

        const sortVoteSelect = document.getElementById('sortVoteBy');
        if (sortVoteSelect) {
            const voteOptions = sortVoteSelect.querySelectorAll('option');
            voteOptions.forEach(option => {
                const value = option.value;
                let key;
                switch (value) {
                    case 'name-asc': key = 'sortByNameAsc'; break;
                    case 'name-desc': key = 'sortByNameDesc'; break;
                    case 'activity-desc': key = 'sortByActivityDesc'; break;
                    case 'activity-asc': key = 'sortByActivityAsc'; break;
                    default: return;
                }
                if (this.translations[this.currentLanguage][key] !== undefined) {
                    option.textContent = this.translations[this.currentLanguage][key];
                }
            });
        }

        const sortInfoSelect = document.getElementById('sortInfoBy');
        if (sortInfoSelect) {
            const infoOptions = sortInfoSelect.querySelectorAll('option');
            infoOptions.forEach(option => {
                const value = option.value;
                let key;
                switch (value) {
                    case 'name-asc': key = 'sortByNameAsc'; break;
                    case 'name-desc': key = 'sortByNameDesc'; break;
                    case 'activity-desc': key = 'sortByActivityDesc'; break;
                    case 'activity-asc': key = 'sortByActivityAsc'; break;
                    default: return;
                }
                if (this.translations[this.currentLanguage][key] !== undefined) {
                    option.textContent = this.translations[this.currentLanguage][key];
                }
            });
        }
    }
};
