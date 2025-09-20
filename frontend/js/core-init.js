// Ensure State exists
window.State = window.State || {};

// Ensure apiClient is available
if (typeof apiClient === 'undefined') {
    console.error("apiClient is not defined. Ensure js/api.js is loaded before js/core-init.js.");
}

document.addEventListener('DOMContentLoaded', async function () {
    console.log("Core initialization logic running...");

    // Setup Tab Switching
    document.querySelectorAll('.tab').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            if (typeof UIController !== 'undefined' && UIController.switchTab) {
                UIController.switchTab(tabName);
            } else {
                console.warn(`UIController.switchTab not available when trying to switch to ${tabName}`);
                // Fallback: Manual tab switching logic
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                document.getElementById(tabName)?.classList.add('active');
                button.classList.add('active');
            }
        });
    });

    // Setup Mobile Menu Toggle
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const headerNav = document.getElementById('headerNav');
    if (mobileMenuToggle && headerNav) {
        mobileMenuToggle.addEventListener('click', () => {
            const isOpen = headerNav.classList.contains('active');
            headerNav.classList.toggle('active', !isOpen);
            mobileMenuToggle.classList.toggle('active', !isOpen);
            mobileMenuToggle.setAttribute('aria-expanded', String(!isOpen));
        });
    }

    // Setup Voting Module Event Listeners
    if (typeof VotingModule !== 'undefined') {
        const candidateSearch = document.getElementById('candidateSearch');
        const sortVoteBy = document.getElementById('sortVoteBy');
        const sortInfoBy = document.getElementById('sortInfoBy');
        const submitVoteBtn = document.getElementById('submitVoteBtn');

        if (candidateSearch) {
            let searchTimeout;
            candidateSearch.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const filter = candidateSearch.value.trim();
                    if (typeof CandidatesModule !== 'undefined' && typeof CandidatesModule.loadCandidates === 'function') {
                        CandidatesModule.loadCandidates({ filter: filter });
                    }
                }, 300); // Debounce
            });
        }

        if (sortVoteBy) {
            sortVoteBy.addEventListener('change', () => {
                if (typeof CandidatesModule !== 'undefined' && typeof CandidatesModule.loadCandidates === 'function') {
                    CandidatesModule.loadCandidates({ sortBy: sortVoteBy.value });
                }
            });
        }

        if (sortInfoBy) {
            sortInfoBy.addEventListener('change', () => {
                if (typeof CandidatesModule !== 'undefined' && typeof CandidatesModule.loadCandidates === 'function') {
                    CandidatesModule.loadCandidates({ sortBy: sortInfoBy.value });
                }
            });
        }

        if (submitVoteBtn) {
            submitVoteBtn.addEventListener('click', () => {
                if (typeof VotingModule !== 'undefined' && VotingModule.submitVote) {
                    VotingModule.submitVote();
                } else {
                    console.error("VotingModule.submitVote is not available.");
                    alert("Voting functionality is not ready. Please try again.");
                }
            });
        }
    } else {
        console.warn("VotingModule not found during core init.");
    }

    // Setup Admin Module Event Listeners
    if (typeof AdminModule !== 'undefined') {
        const addCandidateForm = document.getElementById('addCandidateForm');
        const scheduleElectionBtn = document.getElementById('scheduleElectionBtn');
        const exportVotesBtn = document.getElementById('exportVotesBtn');
        const exportVotesToCSVBtn = document.getElementById('exportVotesToCSVBtn');

        if (addCandidateForm) {
            addCandidateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (typeof AdminModule !== 'undefined' && AdminModule.addCandidate) {
                    try {
                        await AdminModule.addCandidate(new FormData(addCandidateForm));
                    } catch (error) {
                        console.error("Error adding candidate:", error);
                        if (typeof Utils !== 'undefined' && typeof Utils.showMessage === 'function') {
                            Utils.showMessage(`admin.addCandidateError|${error.message}`, 'error');
                        } else {
                            alert(`Error adding candidate: ${error.message}`);
                        }
                    }
                } else {
                    console.error("AdminModule.addCandidate is not available.");
                }
            });
        }

        if (scheduleElectionBtn) {
            scheduleElectionBtn.addEventListener('click', () => {
                if (typeof AdminModule !== 'undefined' && AdminModule.scheduleElection) {
                    AdminModule.scheduleElection();
                } else {
                    console.error("AdminModule.scheduleElection is not available.");
                }
            });
        }

        if (exportVotesBtn) {
            exportVotesBtn.addEventListener('click', () => {
                if (typeof AdminModule !== 'undefined' && AdminModule.exportVotes) {
                    AdminModule.exportVotes();
                } else {
                    console.error("AdminModule.exportVotes is not available.");
                }
            });
        }

        if (exportVotesToCSVBtn) {
            exportVotesToCSVBtn.addEventListener('click', () => {
                if (typeof AdminModule !== 'undefined' && AdminModule.exportVotesToCSV) {
                    AdminModule.exportVotesToCSV();
                } else {
                    console.error("AdminModule.exportVotesToCSV is not available.");
                }
            });
        }
    } else {
        console.warn("AdminModule not found during core init.");
    }

    // Setup Instructions Popup
    const instructionsPopup = document.getElementById('instructionsPopup');
    const closeInstructionsPopup = document.getElementById('closeInstructionsPopup');
    const acknowledgeInstructions = document.getElementById('acknowledgeInstructions');

    function hideInstructionsPopup() {
        if (instructionsPopup) {
            instructionsPopup.classList.add('hidden');
            instructionsPopup.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
    }

    if (closeInstructionsPopup) {
        closeInstructionsPopup.addEventListener('click', hideInstructionsPopup);
    }
    if (acknowledgeInstructions) {
        acknowledgeInstructions.addEventListener('click', hideInstructionsPopup);
    }
    if (instructionsPopup) {
        instructionsPopup.addEventListener('click', (e) => {
            if (e.target === instructionsPopup) {
                hideInstructionsPopup();
            }
        });
    }

    console.log("Core initialization event listeners attached.");
});
