// js/voting.js - Voting Module

const VotingModule = {
    // --- Initialize Voting State and UI Listeners ---
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

    // --- Attach Event Listeners ---
    attachEventListeners: function () {
        const submitVoteBtn = document.getElementById('submitVoteBtn');
        if (submitVoteBtn) {
            submitVoteBtn.addEventListener('click', () => {
                this.submitVote();
            });
        } else {
            console.warn("VotingModule.attachEventListeners: Submit vote button not found.");
        }
        // Sorting and search listeners are handled separately
    },

    // --- Show Candidate Details (Inline) ---
    showCandidateDetails: function (candidateIdOrData) {
        console.log(`VotingModule.showCandidateDetails: Showing details for candidate ID ${candidateIdOrData}`);
        // Determine if input is ID or full data object
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
            // Store reference to active details for potential global hiding
            window.activeDetails = candidateElement;
        }
    },

    // --- Hide Candidate Details (Inline) ---
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
            // Clear global reference if it matches
            if (window.activeDetails === candidateElement) {
                window.activeDetails = null;
            }
        }
    },

    // --- Select/Deselect a Candidate ---
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
                Utils.showValidationError('voting.maxCouncilSelected');
                return;
            }
        }

        // Update UI after selection change
        this.updateUI();
    },

    // --- Toggle Executive Selection ---
    toggleExecutive: function (candidateId) {
        console.log(`VotingModule.toggleExecutive: Attempting to toggle executive for candidate ID ${candidateId}`);
        candidateId = parseInt(candidateId, 10);

        const isCandidateSelected = window.State.selectedCandidates.includes(candidateId);
        const isExecutiveSelected = window.State.executiveCandidates.includes(candidateId);

        if (!isCandidateSelected) {
            console.log(`VotingModule.toggleExecutive: Candidate ID ${candidateId} is not selected as council.`);
            Utils.showValidationError('voting.selectAsCouncilFirst');
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
                Utils.showValidationError('voting.maxExecutiveSelected');
                return;
            }
        }

        // Update UI after executive change
        this.updateUI();
    },

    // --- Update Voting UI based on State ---
    updateUI: function () {
        console.log("VotingModule.updateUI: Updating UI based on state...");
        // Update candidate cards (selected/executive states)
        document.querySelectorAll('.candidate-item').forEach(card => {
            const id = parseInt(card.dataset.id, 10);
            const isSelected = window.State.selectedCandidates.includes(id);
            const isExecutive = window.State.executiveCandidates.includes(id);

            card.classList.toggle('selected', isSelected);
            card.classList.toggle('executive', isExecutive);

            // Update card content or badges if needed (e.g., icons)
            // Example: Add/remove checkmark icons
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

    // --- Update Submit Button State ---
    updateSubmitButton: function () {
        const submitVoteBtn = document.getElementById('submitVoteBtn');
        if (!submitVoteBtn) return;

        const isReady = window.State.selectedCandidates.length === 15 && window.State.executiveCandidates.length === 7;
        submitVoteBtn.disabled = !isReady;
        if (isReady) {
            submitVoteBtn.innerHTML = '<i class="fas fa-paper-plane"></i> <span data-i18n="submitVote">Submit Vote</span>';
        } else {
            submitVoteBtn.innerHTML = '<i class="fas fa-paper-plane"></i> <span data-i18n="submitVote">Submit Vote</span>'; // Keep text, just disable
        }
        // Apply translations for the button
        if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
            I18nModule.applyTranslations(submitVoteBtn);
        }
    },

    // --- Candidate Search Functionality ---
    _searchInitialized: false, // Flag to prevent multiple initializations
    initSearch: function () {
        // Initialize Search Listener (only once)
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
        const candidateItems = document.querySelectorAll('#candidateList .candidate-item'); // Target voting tab list

        candidateItems.forEach(item => {
            const nameElement = item.querySelector('.candidate-name');
            const fieldElement = item.querySelector('.candidate-position');
            const nameText = nameElement ? nameElement.textContent.toLowerCase() : '';
            const fieldText = fieldElement ? fieldElement.textContent.toLowerCase() : '';

            if (nameText.includes(searchTerm) || fieldText.includes(searchTerm)) {
                item.style.display = ''; // Show
            } else {
                item.style.display = 'none'; // Hide
            }
        });
    },

    // --- Submit Vote using apiClient ---
    submitVote: async function () {
        console.log("VotingModule.submitVote: Preparing to submit vote...");
        // --- MODIFIED: Check election state from window.State (set by core-main.js) ---
        if (!window.State.electionOpen) {
            Utils.showMessage('<span data-i18n="electionIsClosed">Voting is currently closed</span>', 'error');
            return;
        }
        if (!window.State.currentUser) {
            Utils.showMessage('<span data-i18n="authenticationRequired">You must be authenticated before submitting.</span>', 'error');
            return;
        }
        if (window.State.selectedCandidates.length !== 15) {
            Utils.showMessage('<span data-i18n="voting.select15Council">Please select exactly 15 candidates</span>', 'error');
            return;
        }
        if (window.State.executiveCandidates.length !== 7) {
            Utils.showMessage('<span data-i18n="voting.select7Executive">Please designate exactly 7 executive officers</span>', 'error');
            return;
        }
        // Ensure all executive candidates are also selected as council members
        const allExecAreCouncil = window.State.executiveCandidates.every(id => window.State.selectedCandidates.includes(id));
        if (!allExecAreCouncil) {
            Utils.showMessage('<span data-i18n="voting.executiveMustBeCouncil">All executive officers must also be selected as council members.</span>', 'error');
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

            // --- MODIFIED: Use apiClient to submit vote ---
            const response = await apiClient.submitVote(
                window.State.selectedCandidates,
                window.State.executiveCandidates
            ); // Uses apiClient
            console.log("VotingModule.submitVote: API response received:", response);

            if (response && response.message) {
                // --- MODIFIED: Use i18n keys for success messages ---
                const successMessage = `<span data-i18n="thankYouForVoting">Thank You for Voting!</span><br><span data-i18n="voteSubmittedMessage">Your vote has been successfully recorded.</span>`;
                Utils.showMessage(successMessage, 'success');

                // Reset selections
                window.State.selectedCandidates = [];
                window.State.executiveCandidates = [];

                // Update user session/vote status
                // Note: Core state (window.State.userHasVoted) is typically updated by core-main.js
                // after a successful vote or initial load. We can set it here too for immediate UI update.
                if (window.State.currentUser) {
                    window.State.currentUser.hasVoted = true;
                }
                window.State.userHasVoted = true; // Set flag for UI logic

                // Update UI
                this.updateUI();

                // Update voting tab content (e.g., show thank you message)
                // This function should be defined in core-main.js or similar
                if (typeof updateVotingTabContent === 'function') {
                    updateVotingTabContent();
                }

                // Clear active details popup if any
                if (typeof window.activeDetails !== 'undefined' && window.activeDetails) {
                    this.hideCandidateDetails(window.activeDetails);
                }

            } else {
                // Handle unexpected response structure
                console.error("VotingModule.submitVote: Unexpected response structure:", response);
                Utils.showMessage('voting.submitUnexpectedError', 'error');
            }

        } catch (error) {
            console.error("VotingModule.submitVote: Error occurred:", error);
            // --- MODIFIED: Use i18n keys for error messages ---
            if (error.message && error.message.includes('already voted')) {
                Utils.showMessage('voting.alreadyVotedError', 'error');
            } else if (error.message && error.message.includes('closed')) {
                 Utils.showMessage('voting.electionClosedError', 'error');
            } else if (error instanceof TypeError && error.message.includes('fetch')) {
                Utils.showMessage('voting.networkError', 'error');
            } else {
                // Generic error message with details
                Utils.showMessage(`voting.submitGenericError|${error.message || 'Unknown error'}`, 'error');
            }
        } finally {
            // Re-enable submit button
            if (submitBtn) {
                // Text is updated by updateUI or above, just ensure it's enabled
                submitBtn.disabled = false;
                // Ensure spinner is gone if error happened early
                if (submitBtn.innerHTML.includes('fa-spinner')) {
                     this.updateSubmitButton(); // Reset to correct state/text
                }
            }
        }
    }
};

// Initialize the Voting Module when the DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Ensure apiClient is available
    if (typeof apiClient === 'undefined') {
         console.error("VotingModule: apiClient is not defined. Ensure js/api.js is loaded first.");
         return;
    }
    VotingModule.init();
});

// Expose the module globally
window.VotingModule = VotingModule;
