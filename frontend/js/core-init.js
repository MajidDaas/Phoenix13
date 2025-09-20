// js/core-init.js - Core Application Initialization Logic

// --- Ensure State exists ---
window.State = window.State || {};
// --- Ensure apiClient is available (it should be loaded before this) ---
if (typeof apiClient === 'undefined') {
    console.error("apiClient is not defined. Ensure js/api.js is loaded before js/core-init.js.");
}

document.addEventListener('DOMContentLoaded', async function () {
    console.log("Core initialization logic running...");

    // --- Setup Tab Switching ---
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

    // --- Setup Mobile Menu Toggle ---
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

    // --- Setup Voting Module Event Listeners ---
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
                    CandidateManager.loadCandidates({ filter: filter });
                }, 300); // Debounce
            });
        }

        if (sortVoteBy) {
            sortVoteBy.addEventListener('change', () => {
                CandidateManager.loadCandidates({ sortBy: sortVoteBy.value });
            });
        }

        if (sortInfoBy) {
            sortInfoBy.addEventListener('change', () => {
                CandidateManager.loadCandidates({ sortBy: sortInfoBy.value }); // Load for info tab
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

    // --- Setup Admin Module Event Listeners ---
    if (typeof AdminModule !== 'undefined') {
        const addCandidateForm = document.getElementById('addCandidateForm');
        const scheduleElectionBtn = document.getElementById('scheduleElectionBtn');
        const exportVotesBtn = document.getElementById('exportVotesBtn');
        const exportVotesToCSVBtn = document.getElementById('exportVotesToCSVBtn');
        // const backupToCloudBtn = document.getElementById('backupToCloudBtn'); // Not implemented

        if (addCandidateForm) {
            addCandidateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (typeof AdminModule !== 'undefined' && AdminModule.addCandidate) {
                    await AdminModule.addCandidate(new FormData(addCandidateForm));
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

        // if (backupToCloudBtn) {
        //     backupToCloudBtn.addEventListener('click', () => {
        //         if (typeof AdminModule !== 'undefined' && AdminModule.backupToCloud) {
        //             AdminModule.backupToCloud();
        //         } else {
        //             console.error("AdminModule.backupToCloud is not available.");
        //         }
        //     });
        // }
    } else {
        console.warn("AdminModule not found during core init.");
    }

    // --- Setup Results Module (if needed, e.g., for periodic refresh) ---
    // Currently, results are loaded on tab switch. Could add periodic refresh here if desired.
    // if (typeof ResultsModule !== 'undefined') { ... }

    // --- Setup Instructions Popup ---
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

    // --- Show Instructions Popup Logic (Conceptual) ---
    // This logic might be better placed in core-main.js after initial auth/election check
    // const hasSeenInstructions = localStorage.getItem('hasSeenVotingInstructions');
    // if (!hasSeenInstructions && window.State.electionOpen && !window.State.userHasVoted) {
    //     // Show popup after a short delay to allow UI to settle
    //     setTimeout(() => {
    //         if (typeof window.showInstructionsPopup === 'function') {
    //             window.showInstructionsPopup();
    //             localStorage.setItem('hasSeenVotingInstructions', 'true');
    //         }
    //     }, 1000);
    // }

    console.log("Core initialization event listeners attached.");
});
