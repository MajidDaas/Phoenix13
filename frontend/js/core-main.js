// Ensure window.State exists and add electionId
window.State = window.State || {};
window.State.electionOpen = true;
window.State.userHasVoted = false;
window.State.currentElectionId = null;

// Ensure i18n globals exist
window.translations = window.translations || {};
window.currentLanguage = window.currentLanguage || 'en';

document.addEventListener('DOMContentLoaded', async function () {
    console.log('Phoenix Council Elections frontend initialized (Multi-Election Version)');

    // Show Skeleton Screen on Auth Screen Initially
    const authScreen = document.getElementById('authScreen');
    const authSkeletonScreen = document.getElementById('authSkeletonScreen');
    let authSkeletonShown = false;
    if (authScreen && authSkeletonScreen) {
        authScreen.style.display = 'flex';
        authSkeletonScreen.style.display = 'flex';
        authSkeletonShown = true;
        console.log("Initial auth skeleton screen shown.");
    }

    // Language Initialization
    if (typeof I18nModule !== 'undefined' && typeof I18nModule.initialize === 'function') {
        try {
            await I18nModule.initialize();
        } catch (initErr) {
            console.error("Error initializing I18nModule:", initErr);
        }
    } else {
        console.warn("I18nModule not found or initialize function missing during core-main init.");
    }

    // Initial Auth Check and Election Flow
    let isAuthenticated = false;
    let userElections = [];

    try {
        // 1. Check if user is authenticated
        const sessionResponse = await apiClient.getSession();
        isAuthenticated = sessionResponse.authenticated;
        if (isAuthenticated) {
            window.State.currentUser = sessionResponse.user;
            console.log("User is authenticated:", window.State.currentUser);

            // 2. Fetch list of elections the user has access to
            userElections = await apiClient.getElections();
            window.userElections = userElections;
            console.log("User elections fetched:", userElections);

            // 3. Determine which election to use
            let selectedElection = null;
            
            // a. Check if one was created by demo auth
            if (typeof window.demoElectionId !== 'undefined' && window.demoElectionId) {
                selectedElection = userElections.find(e => e.id === window.demoElectionId);
                if (selectedElection) {
                    console.log("Using demo election ID:", window.demoElectionId);
                } else {
                    console.warn("Demo election ID is invalid or inaccessible.");
                    delete window.demoElectionId;
                }
            }

            // b. If no valid demo ID, check if one is already selected/stored
            if (!selectedElection) {
                const storedElectionId = localStorage.getItem('selectedElectionId');
                if (storedElectionId) {
                    selectedElection = userElections.find(e => e.id === storedElectionId);
                    if (selectedElection) {
                        console.log("Using stored election ID:", storedElectionId);
                    } else {
                        console.warn("Stored election ID is invalid or inaccessible. Clearing.");
                        localStorage.removeItem('selectedElectionId');
                    }
                }
            }

            // c. If still no election, select the first available one
            if (!selectedElection && userElections.length > 0) {
                selectedElection = userElections[0];
                console.log("No stored/demo election ID, using first available:", selectedElection.id);
            }

            if (selectedElection) {
                window.State.currentElectionId = selectedElection.id;
                apiClient.setCurrentElectionId(selectedElection.id);
                
                // Update UI context
                const electionSubtitleEl = document.getElementById('currentElectionSubtitle');
                if (electionSubtitleEl) {
                    electionSubtitleEl.textContent = selectedElection.name;
                }
                window.currentElection = selectedElection;

                // Fetch initial data for the selected election
                try {
                    const statusResponse = await apiClient.getElectionStatus();
                    window.State.electionOpen = statusResponse.is_open !== undefined ? statusResponse.is_open : false;
                    window.State.electionStartTime = statusResponse.start_time || null;
                    window.State.electionEndTime = statusResponse.end_time || null;
                    console.log("Initial election status fetched:", statusResponse);
                } catch (statusErr) {
                    console.error('Error fetching initial election status:', statusErr);
                    window.State.electionOpen = false;
                }

                // Fetch candidates
                if (typeof CandidatesModule !== 'undefined' && typeof CandidatesModule.loadCandidates === 'function') {
                    CandidatesModule.loadCandidates().catch(err => {
                        console.error("Error loading candidates (initial):", err);
                    });
                } else {
                    console.warn("CandidatesModule.loadCandidates not found during initial load.");
                }

                // Determine if user has voted
                window.State.userHasVoted = window.State.currentUser.hasVoted;

                // Show Main App
                if (authScreen) authScreen.style.display = 'none';
                if (authSkeletonScreen) authSkeletonScreen.style.display = 'none';
                const mainApp = document.getElementById('mainApp');
                if (mainApp) {
                    mainApp.classList.remove('hidden');
                    mainApp.style.display = 'block';
                    console.log("Main app shown for election:", selectedElection.name);
                }

                // Update UI based on state
                if (typeof updateElectionStatusDisplay === 'function') {
                    updateElectionStatusDisplay();
                }
                if (typeof updateVotingTabContent === 'function') {
                    updateVotingTabContent();
                }
                if (typeof VotingModule !== 'undefined' && typeof VotingModule.updateUI === 'function') {
                    VotingModule.updateUI();
                }

                // Show Admin Tab if user is admin for this election
                const adminTabBtn = document.getElementById('adminTabBtn');
                if (adminTabBtn && selectedElection.is_admin) {
                    adminTabBtn.classList.remove('hidden-by-status');
                    console.log("Admin tab button revealed for admin user in this election.");
                } else if (adminTabBtn) {
                    adminTabBtn.classList.add('hidden-by-status');
                }

                // Apply translations
                if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                    I18nModule.applyTranslations();
                }

                // Start election status timer
                if (typeof window.electionStatusTimer !== 'undefined') {
                    clearInterval(window.electionStatusTimer);
                }
                if (typeof updateElectionStatusDisplay === 'function') {
                    window.electionStatusTimer = setInterval(() => {
                        updateElectionStatusDisplay();
                    }, 1000);
                }

            } else {
                // User is authenticated but has no accessible elections
                console.warn("Authenticated user has no accessible elections.");
                if (authSkeletonScreen) authSkeletonScreen.style.display = 'none';
                if (authScreen) authScreen.style.display = 'flex';
                if (typeof Utils !== 'undefined' && typeof Utils.showMessage === 'function') {
                    Utils.showMessage('You do not have access to any elections.', 'error');
                } else {
                    alert("You do not have access to any elections.");
                }
            }
        } else {
            // User is not authenticated
            console.log("User is not authenticated.");
            if (authSkeletonScreen) authSkeletonScreen.style.display = 'none';
            if (authScreen) authScreen.style.display = 'flex';
            console.log("Auth screen shown, main app hidden (not authenticated).");
        }
    } catch (authErr) {
        console.error("Error during initial auth/election check:", authErr);
        isAuthenticated = false;
        if (authSkeletonScreen) authSkeletonScreen.style.display = 'none';
        if (authScreen) authScreen.style.display = 'flex';
        if (typeof Utils !== 'undefined' && typeof Utils.showMessage === 'function') {
            Utils.showMessage('An error occurred while checking your session. Please try again.', 'error');
        } else {
            alert("An error occurred while checking your session. Please try again.");
        }
    }

    // Ensure a valid initial tab is active
    if (isAuthenticated && window.State.currentElectionId && document.getElementById('mainApp') && !document.getElementById('mainApp').classList.contains('hidden')) {
        setTimeout(() => {
            const activeTab = document.querySelector('.tab.active');
            if (!activeTab) {
                const firstTab = document.querySelector('.tab');
                if (firstTab) {
                    firstTab.click();
                    console.log("Activated first tab as none were active.");
                }
            }
            if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                I18nModule.applyTranslations();
            }
        }, 100);
    }

    // Add click outside listener for candidate details and winner popup
    document.addEventListener('click', (e) => {
        // Hide inline candidate details if clicking outside
        if (typeof window.activeDetails !== 'undefined' && window.activeDetails &&
            e.target.closest && !e.target.closest('.candidate-item')) {
            if (typeof VotingModule !== 'undefined' && typeof VotingModule.hideCandidateDetails === 'function') {
                VotingModule.hideCandidateDetails(window.activeDetails);
            } else {
                const activeDetailsElement = document.querySelector(`.candidate-details.show`);
                if (activeDetailsElement) {
                    activeDetailsElement.classList.remove('show');
                    window.activeDetails = null;
                }
            }
        }

        // Hide winner popup if clicking outside
        const winnerInfoPopup = document.getElementById('winnerInfoPopup');
        if (winnerInfoPopup && winnerInfoPopup.style.display === 'block' &&
            !winnerInfoPopup.contains(e.target) && !e.target.closest('.winner-name')) {
            if (typeof ResultsModule !== 'undefined' && typeof ResultsModule.hideWinnerPopup === 'function') {
                ResultsModule.hideWinnerPopup();
            } else {
                winnerInfoPopup.style.display = 'none';
                winnerInfoPopup.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            }
        }
    });

    // Show the Instructions Popup
    window.showInstructionsPopup = function showInstructionsPopup() {
        const popup = document.getElementById('instructionsPopup');
        if (!popup) {
            console.error("Instructions popup element (#instructionsPopup) not found.");
            if (typeof Utils !== 'undefined' && typeof Utils.showMessage === 'function') {
                Utils.showMessage('<span data-i18n="core.instructionsUnavailable">Voting instructions are temporarily unavailable.</span>', 'info');
            } else {
                alert('Voting Instructions: Select 15 Council Members, designate 7 as Executive Officers, review, and submit.');
            }
            return;
        }

        function hidePopup() {
            popup.classList.add('hidden');
            popup.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            console.log("Instructions popup hidden.");
        }

        const closeBtn = document.getElementById('closeInstructionsPopup');
        const ackBtn = document.getElementById('acknowledgeInstructions');
        if (closeBtn) {
            closeBtn.removeEventListener('click', hidePopup);
            closeBtn.addEventListener('click', hidePopup);
        }
        if (ackBtn) {
            ackBtn.removeEventListener('click', hidePopup);
            ackBtn.addEventListener('click', hidePopup);
        }

        function closeOnBackdropClick(e) {
            if (e.target === popup) {
                hidePopup();
            }
        }
        popup.removeEventListener('click', closeOnBackdropClick);
        popup.addEventListener('click', closeOnBackdropClick);

        popup.classList.remove('hidden');
        popup.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        console.log("Instructions popup shown.");
    };

    // Setup Language Switcher
    const langSwitcher = document.getElementById('languageSwitcher');
    if (langSwitcher) {
        const handler = () => {
            if (typeof I18nModule !== 'undefined' && typeof I18nModule.switchLanguage === 'function') {
                const newLang = window.currentLanguage === 'en' ? 'ar' : 'en';
                I18nModule.switchLanguage(newLang);
            }
        };
        langSwitcher.removeEventListener('click', handler);
        langSwitcher.addEventListener('click', handler);
    } else {
        console.warn("Language switcher element (#languageSwitcher) not found during core-main init.");
    }

    // UI Controller
    window.UIController = {
        switchTab: function (tabName) {
            console.log(`Switching to tab: ${tabName}`);

            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));

            const targetContent = document.getElementById(tabName);
            const targetButton = document.querySelector(`.tab[data-tab="${tabName}"]`);

            if (targetContent) targetContent.classList.add('active');
            if (targetButton) targetButton.classList.add('active');

            if (tabName === 'info') {
                if (typeof CandidatesModule !== 'undefined' && typeof CandidatesModule.loadCandidates === 'function') {
                    CandidatesModule.loadCandidates().catch(err => {
                        console.error("Error loading candidates for info tab:", err);
                        const infoListEl = document.getElementById('infoCandidateList');
                        if(infoListEl) {
                            infoListEl.innerHTML = `<p>Error loading candidates: ${err.message}</p>`;
                        }
                    });
                } else {
                    console.warn("CandidatesModule not available to load candidates for info tab.");
                }
            }
            if (tabName === 'admin') {
                if (typeof AdminModule !== 'undefined' && typeof AdminModule.loadAdminCandidates === 'function') {
                    AdminModule.loadAdminCandidates().catch(err => {
                        console.error("Error loading admin candidates:", err);
                        const adminListEl = document.getElementById('existingCandidatesList');
                        if(adminListEl) {
                            adminListEl.innerHTML = `<p>Error loading candidates: ${err.message}</p>`;
                        }
                    });
                } else {
                    console.warn("AdminModule not available to load admin candidates.");
                }
                if (typeof apiClient !== 'undefined') {
                    apiClient.getElectionStatus().then(status => {
                        const startInput = document.getElementById('electionStart');
                        const endInput = document.getElementById('electionEnd');
                        if (startInput) startInput.value = status.start_time ? status.start_time.slice(0, 16) : '';
                        if (endInput) endInput.value = status.end_time ? status.end_time.slice(0, 16) : '';
                    }).catch(err => console.error("Error loading election status for admin:", err));
                }
            }
            if (tabName === 'results') {
                if (typeof ResultsModule !== 'undefined' && typeof ResultsModule.loadResults === 'function') {
                    ResultsModule.loadResults().catch(err => {
                        console.error("Error loading results:", err);
                        const resultsEl = document.getElementById('resultsContent');
                        if(resultsEl) {
                            resultsEl.innerHTML = `<p>Error loading results: ${err.message}</p>`;
                        }
                    });
                } else {
                    console.warn("ResultsModule not available to load results.");
                }
            }

            if (typeof ResultsModule !== 'undefined' && typeof ResultsModule.hideWinnerPopup === 'function') {
                ResultsModule.hideWinnerPopup();
            } else {
                const winnerPopup = document.getElementById('winnerInfoPopup');
                if (winnerPopup) {
                    winnerPopup.style.display = 'none';
                    winnerPopup.setAttribute('aria-hidden', 'true');
                }
            }

            const headerNav = document.getElementById('headerNav');
            const mobileMenuToggle = document.getElementById('mobileMenuToggle');
            if (headerNav && mobileMenuToggle) {
                if (headerNav.classList.contains('active')) {
                    headerNav.classList.remove('active');
                    mobileMenuToggle.classList.remove('active');
                    mobileMenuToggle.setAttribute('aria-expanded', 'false');
                    console.log("Mobile menu closed after tab switch.");
                }
            }
        }
    };

    // Function to Update Voting Tab Content Based on State
    window.updateVotingTabContent = function updateVotingTabContent() {
        const votingInterface = document.getElementById('votingInterface');
        const electionClosedMessageElement = document.getElementById('electionClosedMessage');
        const thankYouMessageElement = document.getElementById('thankYouMessage');
        const notRegisteredCard = document.getElementById('notRegisteredCard');

        console.log("updateVotingTabContent - Election Open:", window.State.electionOpen, "User Voted:", window.State.userHasVoted);

        // Initially hide all
        [electionClosedMessageElement, thankYouMessageElement, notRegisteredCard, votingInterface].forEach(el => {
            if (el) el.classList.add('hidden');
        });

        if (window.State.currentUser && window.State.currentUser.isEligibleVoter) {
            if (window.State.userHasVoted) {
                console.log("User has already voted.");
                if (thankYouMessageElement) thankYouMessageElement.classList.remove('hidden');
            } else if (!window.State.electionOpen) {
                console.log("Election is closed and user hasn't voted.");
                if (electionClosedMessageElement) electionClosedMessageElement.classList.remove('hidden');
            } else {
                console.log("Election is open and user hasn't voted. Showing voting interface.");
                if (votingInterface) votingInterface.classList.remove('hidden');
            }
        } else {
            console.log("User is not eligible to vote in this election.");
            if(notRegisteredCard) notRegisteredCard.classList.remove('hidden');
            if(votingInterface) votingInterface.classList.add('hidden');
        }
    }

    // Helper Function: Format Time Duration
    window.formatDuration = function formatDuration(ms) {
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);

        let parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (parts.length === 0 || seconds > 0) parts.push(`${seconds}s`);
        return parts.join(' ');
    }

    // Helper Function: Update Election Status Display
    window.updateElectionStatusDisplay = function updateElectionStatusDisplay() {
        const electionStatusElement = document.getElementById('electionStatus');
        if (!electionStatusElement) return;

        const startTime = window.State.electionStartTime ? new Date(window.State.electionStartTime) : null;
        const endTime = window.State.electionEndTime ? new Date(window.State.electionEndTime) : null;
        const now = new Date();

        let statusText = '';
        let statusClass = '';
        let iconClass = '';

        if (startTime && endTime) {
            if (now < startTime) {
                const timeToStart = startTime - now;
                statusText = `Election opens in ${formatDuration(timeToStart)}`;
                statusClass = 'pending';
                iconClass = 'fa-hourglass-start';
            } else if (now >= startTime && now < endTime) {
                const timeToEnd = endTime - now;
                statusText = `Election closes in ${formatDuration(timeToEnd)}`;
                statusClass = 'open';
                iconClass = 'fa-lock-open';
            } else {
                statusText = 'Election has ended';
                statusClass = 'closed';
                iconClass = 'fa-lock';
            }
        } else {
            if (window.State.electionOpen) {
                statusText = 'Election is open';
                statusClass = 'open';
                iconClass = 'fa-lock-open';
            } else {
                statusText = 'Election is closed';
                statusClass = 'closed';
                iconClass = 'fa-lock';
            }
        }

        electionStatusElement.innerHTML = `<i class="fas ${iconClass}"></i> <span data-i18n="electionStatus">${statusText}</span>`;
        electionStatusElement.className = `election-status ${statusClass}`;

        if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
            I18nModule.applyTranslations(electionStatusElement);
        }
    }
});
