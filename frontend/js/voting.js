const VotingModule = {
    // Initialize Voting State and UI Listeners
    init: function () {
        console.log("VotingModule.init: Initializing voting module...");
        
        // Ensure state exists
        window.State = window.State || {};
        window.State.selectedCandidates = window.State.selectedCandidates || [];
        window.State.executiveCandidates = window.State.executiveCandidates || [];

        // Attach event listeners for voting actions
        this.attachEventListeners();

        // Initialize candidate search
        this.initSearch();

        // Update UI based on initial state
        this.updateUI();

        console.log("VotingModule.init: Voting module initialized.");
    },

    // Attach Event Listeners
    attachEventListeners: function () {
        const submitVoteBtn = document.getElementById('submitVoteBtn');
        if (submitVoteBtn) {
            submitVoteBtn.addEventListener('click', () => {
                this.submitVote();
            });
        } else {
            console.warn("VotingModule.attachEventListeners: Submit vote button not found.");
        }
    },

    // Show Candidate Details (Inline)
    showCandidateDetails: function (candidateIdOrData) {
        console.log(`VotingModule.showCandidateDetails: Showing details for candidate ID ${candidateIdOrData}`);
        
        let candidateData;
        if (typeof candidateIdOrData === 'number' || typeof candidateIdOrData === 'string') {
            candidateData = window.State.candidates?.find(c => c.id === parseInt(candidateIdOrData));
        } else {
            candidateData = candidateIdOrData;
        }

        if (!candidateData) {
            console.error("VotingModule.showCandidateDetails: Candidate data not found.");
            return;
        }

        const candidateElement = document.querySelector(`.candidate-item[data-id="${candidateData.id}"]`);
        if (!candidateElement) {
            console.warn(`VotingModule.showCandidateDetails: Candidate element with ID ${candidateData.id} not found.`);
            return;
        }

        const detailsElement = candidateElement.querySelector(`.candidate-details`);
        if (detailsElement) {
            detailsElement.style.display = 'block';
            window.activeDetails = candidateElement;
        }
    },

    // Hide Candidate Details (Inline)
    hideCandidateDetails: function (candidateElementOrId) {
        let candidateElement;
        if (typeof candidateElementOrId === 'number' || typeof candidateElementOrId === 'string') {
            candidateElement = document.querySelector(`.candidate-item[data-id="${candidateElementOrId}"]`);
        } else {
            candidateElement = candidateElementOrId;
        }

        if (candidateElement) {
            const detailsElement = candidateElement.querySelector('.candidate-details');
            if (detailsElement) {
                detailsElement.style.display = 'none';
            }
            if (window.activeDetails === candidateElement) {
                window.activeDetails = null;
            }
        }
    },

    // Select/Deselect a Candidate
    selectCandidate: function (candidateId) {
        console.log(`VotingModule.selectCandidate: Attempting to select/deselect candidate ID ${candidateId}`);
        candidateId = parseInt(candidateId, 10);

        const candidate = window.State.candidates?.find(c => c.id === candidateId);
        if (!candidate) {
            console.warn(`VotingModule.selectCandidate: Candidate with ID ${candidateId} not found in state.`);
            return;
        }

        const isSelected = window.State.selectedCandidates.includes(candidateId);
        const isExecutive = window.State.executiveCandidates.includes(candidateId);

        if (isSelected) {
            // Deselect candidate
            window.State.selectedCandidates = window.State.selectedCandidates.filter(id => id !== candidateId);
            window.State.executiveCandidates = window.State.executiveCandidates.filter(id => id !== candidateId);
            console.log(`VotingModule.selectCandidate: Deselected candidate ID ${candidateId}`);
        } else {
            // Select candidate (if space allows)
            if (window.State.selectedCandidates.length < 15) {
                window.State.selectedCandidates.push(candidateId);
                console.log(`VotingModule.selectCandidate: Selected candidate ID ${candidateId}`);
            } else {
                console.log(`VotingModule.selectCandidate: Cannot select more than 15 candidates.`);
                this.showValidationError('voting.maxCouncilSelected');
                return;
            }
        }

        // Update UI after selection change
        this.updateUI();
    },

    // Toggle Executive Selection
    toggleExecutive: function (candidateId) {
        console.log(`VotingModule.toggleExecutive: Attempting to toggle executive for candidate ID ${candidateId}`);
        candidateId = parseInt(candidateId, 10);

        const isCandidateSelected = window.State.selectedCandidates.includes(candidateId);
        const isExecutiveSelected = window.State.executiveCandidates.includes(candidateId);

        if (!isCandidateSelected) {
            console.log(`VotingModule.toggleExecutive: Candidate ID ${candidateId} is not selected as council.`);
            this.showValidationError('voting.selectAsCouncilFirst');
            return;
        }

        if (isExecutiveSelected) {
            // Remove from executive
            window.State.executiveCandidates = window.State.executiveCandidates.filter(id => id !== candidateId);
            console.log(`VotingModule.toggleExecutive: Removed candidate ID ${candidateId} from executive.`);
        } else {
            // Add to executive (if space allows)
            if (window.State.executiveCandidates.length < 7) {
                window.State.executiveCandidates.push(candidateId);
                console.log(`VotingModule.toggleExecutive: Added candidate ID ${candidateId} to executive.`);
            } else {
                console.log(`VotingModule.toggleExecutive: Cannot select more than 7 executive officers.`);
                this.showValidationError('voting.maxExecutiveSelected');
                return;
            }
        }

        // Update UI after executive change
        this.updateUI();
    },

    // Update Voting UI based on State
    updateUI: function () {
        console.log("VotingModule.updateUI: Updating UI based on state...");
        
        // Update candidate cards (selected/executive states)
        document.querySelectorAll('.candidate-item').forEach(card => {
            const id = parseInt(card.dataset.id, 10);
            const isSelected = window.State.selectedCandidates.includes(id);
            const isExecutive = window.State.executiveCandidates.includes(id);

            card.classList.toggle('selected', isSelected);
            card.classList.toggle('executive', isExecutive);

            // Update card content or badges if needed
            let checkmark = card.querySelector('.selection-checkmark');
            if (isSelected && !checkmark) {
                checkmark = document.createElement('div');
                checkmark.className = 'selection-checkmark';
                checkmark.innerHTML = '<i class="fas fa-check"></i>';
                card.appendChild(checkmark);
            } else if (!isSelected && checkmark) {
                checkmark.remove();
            }

            let star = card.querySelector('.executive-star');
            if (isExecutive && !star) {
                star = document.createElement('div');
                star.className = 'executive-star';
                star.innerHTML = '<i class="fas fa-star"></i>';
                card.appendChild(star);
            } else if (!isExecutive && star) {
                star.remove();
            }
        });

        // Update counters
        const selectedCountEl = document.getElementById('selectedCount');
        const executiveCountEl = document.getElementById('executiveCount');
        if (selectedCountEl) {
            selectedCountEl.textContent = `${window.State.selectedCandidates.length} / 15`;
        }
        if (executiveCountEl) {
            executiveCountEl.textContent = `${window.State.executiveCandidates.length} / 7`;
        }

        // Update submit button state
        this.updateSubmitButton();

        console.log("VotingModule.updateUI: UI update complete.");
    },

    // Update Submit Button State
    updateSubmitButton: function () {
        const submitVoteBtn = document.getElementById('submitVoteBtn');
        if (!submitVoteBtn) return;

        const isReady = window.State.selectedCandidates.length === 15 && window.State.executiveCandidates.length === 7;
        submitVoteBtn.disabled = !isReady;
        submitVoteBtn.innerHTML = '<i class="fas fa-paper-plane"></i> <span data-i18n="submitVote">Submit Vote</span>';
        
        // Apply translations for the button
        if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
            I18nModule.applyTranslations(submitVoteBtn);
        }
    },

    // Candidate Search Functionality
    _searchInitialized: false,
    initSearch: function () {
        if (!this._searchInitialized) {
            const candidateSearchInput = document.getElementById('candidateSearch');
            if (candidateSearchInput) {
                candidateSearchInput.removeEventListener('input', this.handleSearch);
                candidateSearchInput.addEventListener('input', this.handleSearch.bind(this));
                console.log("VotingModule.initSearch: Candidate search listener initialized.");
            } else {
                console.warn("VotingModule.initSearch: Candidate search input not found.");
            }
            this._searchInitialized = true;
        }
    },

    handleSearch: function (event) {
        const searchTerm = event.target.value.toLowerCase().trim();
        const candidateItems = document.querySelectorAll('#candidateList .candidate-item');

        candidateItems.forEach(item => {
            const nameElement = item.querySelector('.candidate-name');
            const fieldElement = item.querySelector('.candidate-position');
            const nameText = nameElement ? nameElement.textContent.toLowerCase() : '';
            const fieldText = fieldElement ? fieldElement.textContent.toLowerCase() : '';

            if (nameText.includes(searchTerm) || fieldText.includes(searchTerm)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    },

    // Submit Vote using apiClient
    submitVote: async function () {
        console.log("VotingModule.submitVote: Preparing to submit vote...");
        
        if (!window.State.electionOpen) {
            this.showValidationError('electionIsClosed');
            return;
        }
        if (!window.State.currentUser) {
            this.showValidationError('authenticationRequired');
            return;
        }
        if (window.State.selectedCandidates.length !== 15) {
            this.showValidationError('voting.select15Council');
            return;
        }
        if (window.State.executiveCandidates.length !== 7) {
            this.showValidationError('voting.select7Executive');
            return;
        }
        
        const allExecAreCouncil = window.State.executiveCandidates.every(id => window.State.selectedCandidates.includes(id));
        if (!allExecAreCouncil) {
            this.showValidationError('voting.executiveMustBeCouncil');
            return;
        }

        const submitBtn = document.getElementById('submitVoteBtn');
        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span data-i18n="submittingVote">Submitting...</span>';
                if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                    I18nModule.applyTranslations(submitBtn);
                }
            }

            const response = await apiClient.submitVote(
                window.State.selectedCandidates,
                window.State.executiveCandidates
            );
            console.log("VotingModule.submitVote: API response received:", response);

            if (response && response.message) {
                const successMessage = '<span data-i18n="thankYouForVoting">Thank You for Voting!</span><br><span data-i18n="voteSubmittedMessage">Your vote has been successfully recorded.</span>';
                this.showSuccessMessage(successMessage);

                // Reset selections
                window.State.selectedCandidates = [];
                window.State.executiveCandidates = [];

                // Update user session/vote status
                if (window.State.currentUser) {
                    window.State.currentUser.hasVoted = true;
                }
                window.State.userHasVoted = true;

                // Update UI
                this.updateUI();

                // Update voting tab content
                if (typeof updateVotingTabContent === 'function') {
                    updateVotingTabContent();
                }

                // Clear active details popup if any
                if (typeof window.activeDetails !== 'undefined' && window.activeDetails) {
                    this.hideCandidateDetails(window.activeDetails);
                }

            } else {
                console.error("VotingModule.submitVote: Unexpected response structure:", response);
                this.showValidationError('voting.submitUnexpectedError');
            }

        } catch (error) {
            console.error("VotingModule.submitVote: Error occurred:", error);
            if (error.message && error.message.includes('already voted')) {
                this.showValidationError('voting.alreadyVotedError');
            } else if (error.message && error.message.includes('closed')) {
                this.showValidationError('voting.electionClosedError');
            } else if (error instanceof TypeError && error.message.includes('fetch')) {
                this.showValidationError('voting.networkError');
            } else {
                this.showValidationError(`voting.submitGenericError|${error.message || 'Unknown error'}`);
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                if (submitBtn.innerHTML.includes('fa-spinner')) {
                    this.updateSubmitButton();
                }
            }
        }
    },

    // Helper methods
    showValidationError: function(messageKey) {
        if (typeof Utils !== 'undefined' && typeof Utils.showMessage === 'function') {
            Utils.showMessage(messageKey, 'error');
        } else {
            // Fallback to simple alert
            const messages = {
                'voting.maxCouncilSelected': 'Please select exactly 15 candidates',
                'voting.selectAsCouncilFirst': 'Please select candidate as council member first',
                'voting.maxExecutiveSelected': 'Please designate exactly 7 executive officers',
                'electionIsClosed': 'Voting is currently closed',
                'authenticationRequired': 'You must be authenticated before submitting.',
                'voting.select15Council': 'Please select exactly 15 candidates',
                'voting.select7Executive': 'Please designate exactly 7 executive officers',
                'voting.executiveMustBeCouncil': 'All executive officers must also be selected as council members.',
                'voting.alreadyVotedError': 'You have already voted in this election',
                'voting.electionClosedError': 'Election is currently closed',
                'voting.networkError': 'Network error occurred. Please try again.',
                'voting.submitUnexpectedError': 'Unexpected error occurred. Please try again.'
            };
            alert(messages[messageKey] || messageKey);
        }
    },

    showSuccessMessage: function(message) {
        if (typeof Utils !== 'undefined' && typeof Utils.showMessage === 'function') {
            Utils.showMessage(message, 'success');
        } else {
            // Fallback to simple alert
            alert('Vote submitted successfully!');
        }
    }
};

// Initialize the Voting Module when the DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    if (typeof apiClient === 'undefined') {
        console.error("VotingModule: apiClient is not defined. Ensure js/api.js is loaded first.");
        return;
    }
    VotingModule.init();
});

// Expose the module globally
window.VotingModule = VotingModule;
