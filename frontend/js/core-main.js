// js/core-main.js - App initialization (runs after all modules are loaded) (Multi-Election Version)

// --- MODIFIED: Ensure window.State exists and add electionId ---
window.State = window.State || {};
window.State.electionOpen = true; // Default assumption
window.State.userHasVoted = false; // Default assumption
window.State.currentElectionId = null; // Track the current election ID

document.addEventListener('DOMContentLoaded', async function () {
    console.log('Phoenix Council Elections frontend initialized (Multi-Election Version)');

    // --- MODIFIED: Show Skeleton Screen on Auth Screen Initially ---
    const authScreen = document.getElementById('authScreen');
    const authSkeletonScreen = document.getElementById('authSkeletonScreen');
    let authSkeletonShown = false;
    if (authScreen && authSkeletonScreen) {
        authScreen.style.display = 'flex';
        authSkeletonScreen.style.display = 'flex';
        authSkeletonShown = true;
        console.log("Initial auth skeleton screen shown.");
    }

    // --- Language Initialization (Conceptual - relies on i18n.js being loaded) ---
    // The actual implementation details for fetching and setting language are
    // typically handled by the I18nModule. This just ensures it's triggered.
    if (typeof I18nModule !== 'undefined' && typeof I18nModule.initialize === 'function') {
         try {
             await I18nModule.initialize(); // Or similar init function if it exists
         } catch (initErr) {
             console.error("Error initializing I18nModule:", initErr);
         }
    } else {
        console.warn("I18nModule not found or initialize function missing during core-main init.");
    }

    // --- MODIFIED: Initial Auth Check and Election Flow ---
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
            window.userElections = userElections; // Store globally if needed elsewhere
            console.log("User elections fetched:", userElections);

            // 3. Determine which election to use
            // a. Check if one was created by demo auth (window.demoElectionId)
            let selectedElection = null;
            if (typeof window.demoElectionId !== 'undefined' && window.demoElectionId) {
                selectedElection = userElections.find(e => e.id === window.demoElectionId);
                if (selectedElection) {
                    console.log("Using demo election ID:", window.demoElectionId);
                } else {
                    console.warn("Demo election ID is invalid or inaccessible.");
                    // Clear the invalid ID
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

            // c. If still no election, select the first available one (or show selection screen)
            // For simplicity here, we select the first. A real app might show a list.
            if (!selectedElection && userElections.length > 0) {
                selectedElection = userElections[0];
                console.log("No stored/demo election ID, using first available:", selectedElection.id);
                // Optionally, you could trigger the election selection screen here instead
                // if (userElections.length > 1) { showElectionSelectionScreen(); return; }
            }

            if (selectedElection) {
                window.State.currentElectionId = selectedElection.id;
                apiClient.setCurrentElectionId(selectedElection.id); // Set in API client
                // Update UI context (e.g., header)
                const electionSubtitleEl = document.getElementById('currentElectionSubtitle');
                if (electionSubtitleEl) {
                    electionSubtitleEl.textContent = selectedElection.name;
                }
                window.currentElection = selectedElection; // Store details if needed

                // 4. Fetch initial data for the selected election
                // Fetch election status
                try {
                    const statusResponse = await apiClient.getElectionStatus();
                    window.State.electionOpen = statusResponse.is_open !== undefined ? statusResponse.is_open : false;
                    window.State.electionStartTime = statusResponse.start_time || null;
                    window.State.electionEndTime = statusResponse.end_time || null;
                    console.log("Initial election status fetched:", statusResponse);
                } catch (statusErr) {
                    console.error('Error fetching initial election status:', statusErr);
                    window.State.electionOpen = false; // Default to closed on error
                }

                // Fetch candidates (non-critical for initial display)
                // The CandidatesModule.loadCandidates() will use apiClient.getCandidates()
                // which now includes the election ID context.
                // We can trigger this load, but don't necessarily need to await it here
                // unless it's critical for the initial render.
                if (typeof CandidatesModule !== 'undefined' && typeof CandidatesModule.loadCandidates === 'function') {
                     CandidatesModule.loadCandidates().catch(err => {
                         console.error("Error loading candidates (initial):", err);
                         // Handle error in UI if critical
                     });
                } else {
                     console.warn("CandidatesModule.loadCandidates not found during initial load.");
                }


                // Determine if user has voted (based on session or by checking votes for this election)
                // This logic might need refinement based on how votes are checked per-election on the backend
                window.State.userHasVoted = window.State.currentUser.hasVoted; // Or check via API if needed

                // --- Show Main App ---
                if (authScreen) authScreen.style.display = 'none';
                if (authSkeletonScreen) authSkeletonScreen.style.display = 'none';
                const mainApp = document.getElementById('mainApp');
                if (mainApp) {
                    mainApp.classList.remove('hidden');
                    mainApp.style.display = 'block';
                    console.log("Main app shown for election:", selectedElection.name);
                }

                // --- Update UI based on state ---
                // Function assumed to exist globally or be defined here
                if (typeof updateElectionStatusDisplay === 'function') {
                     updateElectionStatusDisplay(); // Update header status
                }
                if (typeof updateVotingTabContent === 'function') {
                     updateVotingTabContent(); // Show/hide voting interface based on election status/user vote status
                }
                if (typeof VotingModule !== 'undefined' && typeof VotingModule.updateUI === 'function') {
                     VotingModule.updateUI(); // Update candidate selection UI
                }

                // Show Admin Tab if user is admin for this election
                const adminTabBtn = document.getElementById('adminTabBtn');
                if (adminTabBtn && selectedElection.is_admin) {
                    adminTabBtn.classList.remove('hidden-by-status');
                    console.log("Admin tab button revealed for admin user in this election.");
                } else if (adminTabBtn) {
                     adminTabBtn.classList.add('hidden-by-status'); // Ensure it's hidden if not admin
                }

                // Apply translations if i18n module is ready
                if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                    I18nModule.applyTranslations();
                }

                // Start election status timer if function exists
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
                // This case should ideally be handled in auth.js after login
                // For now, show auth screen or an error
                 if (authSkeletonScreen) authSkeletonScreen.style.display = 'none';
                 if (authScreen) authScreen.style.display = 'flex';
                 alert("You do not have access to any elections.");
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
        alert("An error occurred while checking your session. Please try again.");
    }

    // --- Wait for other non-critical initial loads (if any remain and are Promises) ---
    // The candidate loading is initiated above.
    // If there were other independent initial loads that returned promises,
    // they would be awaited here using Promise.all([promise1, promise2, ...])
    // For example, if there was a separate non-critical data load:
    // try {
    //     await Promise.all([someOtherNonCriticalLoadPromise]);
    //     console.log("Non-critical initial data loaded.");
    // } catch (error) {
    //     console.error("One or more non-critical initial loads failed:", error);
    // }

    // --- Ensure a valid initial tab is active ---
    if (isAuthenticated && window.State.currentElectionId && document.getElementById('mainApp') && !document.getElementById('mainApp').classList.contains('hidden')) {
        setTimeout(() => {
            const activeTab = document.querySelector('.tab.active');
            if (!activeTab) {
                // If no tab is active, activate the first one
                const firstTab = document.querySelector('.tab');
                if (firstTab) {
                    firstTab.click();
                    console.log("Activated first tab as none were active.");
                }
            }
            // Apply translations one final time after tab activation
            if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                I18nModule.applyTranslations();
            }
        }, 100); // Small delay to ensure DOM is fully ready
    }

    // --- Add click outside listener for candidate details and winner popup (Conceptual) ---
    // This logic should ideally be in core-init.js or a dedicated module for event listeners.
    // Placing it here ensures it's added after DOM content is loaded.
    document.addEventListener('click', (e) => {
        // Hide inline candidate details if clicking outside
        if (typeof window.activeDetails !== 'undefined' && window.activeDetails &&
            e.target.closest && !e.target.closest('.candidate-item')) {
            // Assuming VotingModule has a method or the logic is accessible
            // This part depends on the specific implementation in voting.js/candidates.js
            // If VotingModule.hideCandidateDetails is the function:
            if (typeof VotingModule !== 'undefined' && typeof VotingModule.hideCandidateDetails === 'function') {
                 // This might need the specific element or ID, logic depends on implementation
                 // VotingModule.hideCandidateDetails(window.activeDetails);
                 // Or, if it's based on an ID stored:
                 // VotingModule.hideCandidateDetails(window.activeDetails); // if ID is stored
                 // Or, find the element and hide it directly if no module function:
                 const activeDetailsElement = document.querySelector(`.candidate-details.show`);
                 if (activeDetailsElement) {
                      activeDetailsElement.classList.remove('show');
                      window.activeDetails = null; // Clear reference
                 }
            } else {
                // Fallback: try to find and hide the active details element directly
                const activeDetailsElement = document.querySelector(`.candidate-details.show`);
                if (activeDetailsElement) {
                     activeDetailsElement.classList.remove('show');
                     if (typeof window !== 'undefined') {
                         window.activeDetails = null;
                     }
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

    // --- ADD THIS NEW FUNCTION: Show the Instructions Popup (Conceptual) ---
    // This function definition ensures it exists globally. The trigger logic
    // (e.g., showing it automatically for new users) should be handled elsewhere,
    // perhaps after the main app is initialized and the user state is known.
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
            closeBtn.removeEventListener('click', hidePopup); // Remove old listeners
            closeBtn.addEventListener('click', hidePopup);
        }
        if (ackBtn) {
            ackBtn.removeEventListener('click', hidePopup); // Remove old listeners
            ackBtn.addEventListener('click', hidePopup);
        }

        function closeOnBackdropClick(e) {
            if (e.target === popup) {
                hidePopup();
            }
        }
        popup.removeEventListener('click', closeOnBackdropClick); // Remove old listener
        popup.addEventListener('click', closeOnBackdropClick);

        popup.classList.remove('hidden');
        popup.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        console.log("Instructions popup shown.");
    };
    // --- END NEW FUNCTION ---

    // --- Authentication Callback Handler (Conceptual - handled more in auth.js now) ---
    // The main logic for handling Google OAuth callback is now in auth.js
    // This part might be simplified or removed if auth.js handles the redirect fully.
    // function handleAuthCallback() {
    //     const urlParams = new URLSearchParams(window.location.search);
    //     const authenticated = urlParams.get('authenticated');
    //     console.log("Handling auth callback. Authenticated param:", authenticated);
    //     if (authenticated === 'true') {
    //         console.log("Redirected from Google OAuth2, re-checking auth status...");
    //         // The main checkAuthStatus logic now includes election fetching
    //         // AuthModule.checkAuthStatus().then((isAuth) => { ... });
    //         // It's better to let the main flow in this DOMContentLoaded handler deal with it
    //         // after a potential page reload triggered by auth.js
    //     }
    // }
    // handleAuthCallback(); // This might be called by auth.js differently now

    // --- Setup Language Switcher (Conceptual) ---
    // This should ideally be in core-init.js, but ensuring it exists here is fine.
    const langSwitcher = document.getElementById('languageSwitcher');
    if (langSwitcher) {
        // Remove any existing listener to prevent duplicates
        const newLang = window.currentLanguage === 'en' ? 'ar' : 'en';
        const handler = () => {
             if (typeof I18nModule !== 'undefined' && typeof I18nModule.switchLanguage === 'function') {
                 const newLang = window.currentLanguage === 'en' ? 'ar' : 'en';
                 I18nModule.switchLanguage(newLang);
             }
        };
        langSwitcher.removeEventListener('click', handler); // Remove old
        langSwitcher.addEventListener('click', handler); // Add new
    } else {
        console.warn("Language switcher element (#languageSwitcher) not found during core-main init.");
    }

    // --- UI Controller (Largely Unchanged, but context-aware) ---
    window.UIController = {
        switchTab: function (tabName) {
            console.log(`Switching to tab: ${tabName}`);

            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));

            const targetContent = document.getElementById(tabName);
            const targetButton = document.querySelector(`.tab[data-tab="${tabName}"]`);

            if (targetContent) targetContent.classList.add('active');
            if (targetButton) targetButton.classList.add('active');

            // --- MODIFIED: Load content specific to the selected election if needed ---
            if (tabName === 'info') {
                // Ensure candidates are loaded for the info tab
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
                // Ensure admin candidates are loaded
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
                // Ensure election status is current for admin controls
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
                // Refresh results when switching to the tab
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
            // --- END MODIFIED ---

            // Hide winner popup when switching tabs if ResultsModule exists
            if (typeof ResultsModule !== 'undefined' && typeof ResultsModule.hideWinnerPopup === 'function') {
                ResultsModule.hideWinnerPopup();
            } else {
                // Fallback hide
                const winnerPopup = document.getElementById('winnerInfoPopup');
                if (winnerPopup) {
                     winnerPopup.style.display = 'none';
                     winnerPopup.setAttribute('aria-hidden', 'true');
                }
            }

            // Close mobile menu on tab switch
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

    // --- Function to Update Voting Tab Content Based on State (Conceptual) ---
    // This function needs to be defined in the global scope to be called by other parts
    // like the timer or after a vote is submitted.
    window.updateVotingTabContent = function updateVotingTabContent() {
        const votingInterface = document.getElementById('votingInterface');
        const electionClosedMessageElement = document.getElementById('electionClosedMessage');
        const thankYouMessageElement = document.getElementById('thankYouMessage');
        const notRegisteredCard = document.getElementById('notRegisteredCard'); // Assuming this check is done elsewhere or removed

        console.log("updateVotingTabContent - Election Open:", window.State.electionOpen, "User Voted:", window.State.userHasVoted);

        // Initially hide all
        [electionClosedMessageElement, thankYouMessageElement, notRegisteredCard, votingInterface].forEach(el => {
             if (el) el.classList.add('hidden');
        });

        // --- MODIFIED: Logic based on election state and user permissions ---
        if (window.State.currentUser && window.State.currentUser.isEligibleVoter) { // Check eligibility for *this* election context
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
             // User is not eligible to vote in this election
             console.log("User is not eligible to vote in this election.");
             if(notRegisteredCard) notRegisteredCard.classList.remove('hidden');
             // Optionally hide the voting interface entirely or show a specific message within it
             if(votingInterface) votingInterface.classList.add('hidden');
        }
        // --- END MODIFIED ---
    }

    // --- Helper Function: Format Time Duration (Conceptual) ---
    // This function is used by updateElectionStatusDisplay
    window.formatDuration = function formatDuration(ms) {
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);

        let parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        // Show seconds if no larger units or for precision
        if (parts.length === 0 || seconds > 0) parts.push(`${seconds}s`);
        return parts.join(' ');
    }

    // --- Helper Function: Update Election Status Display (for Timer) (Conceptual) ---
    // This function is used by the timer and needs to be globally accessible
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
                statusText = `Election opens in ${formatDuration(timeToStart)}`; // i18n key placeholder
                statusClass = 'pending';
                iconClass = 'fa-hourglass-start';
            } else if (now >= startTime && now < endTime) {
                const timeToEnd = endTime - now;
                statusText = `Election closes in ${formatDuration(timeToEnd)}`; // i18n key placeholder
                statusClass = 'open';
                iconClass = 'fa-lock-open';
            } else {
                statusText = 'Election has ended'; // i18n key placeholder
                statusClass = 'closed';
                iconClass = 'fa-lock';
            }
        } else {
            // If schedule is not set, rely on the boolean flag (less ideal)
            if (window.State.electionOpen) {
                statusText = 'Election is open'; // i18n key placeholder
                statusClass = 'open';
                iconClass = 'fa-lock-open';
            } else {
                statusText = 'Election is closed'; // i18n key placeholder
                statusClass = 'closed';
                iconClass = 'fa-lock';
            }
        }

        electionStatusElement.innerHTML = `<i class="fas ${iconClass}"></i> <span data-i18n="electionStatus">${statusText}</span>`;
        electionStatusElement.className = `election-status ${statusClass}`; // Update class

        // Apply translation to the dynamic text if i18n module is ready
        if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
            I18nModule.applyTranslations(electionStatusElement);
        }
    }

    // --- Initial Candidate Load (Handled Above via CandidatesModule.loadCandidates()) ---
    // The initial candidate load logic is integrated into the main auth/election flow above.
    // let candidatesLoadPromise = Promise.resolve(); // Default resolved promise
    // if (isAuthenticated) {
    //     // Trigger candidate load, but don't block the main flow necessarily
    //     // unless it's critical for the initial view (e.g., voting tab is default)
    //     if (typeof CandidatesModule !== 'undefined' && typeof CandidatesModule.loadCandidates === 'function') {
    //          candidatesLoadPromise = CandidatesModule.loadCandidates().catch(err => {
    //              console.error("Error loading candidates (initial):", err);
    //              // Handle candidate loading error if critical for initial display
    //              // e.g., show error in candidate list area
    //          });
    //     } else {
    //          console.warn("CandidatesModule.loadCandidates not found during initial candidate load setup.");
    //     }
    // }

    // --- Start Checking Auth Status (Handled Above) ---
    // The main auth and election data fetching logic is now handled in the main try/catch block above.
    // let isAuthenticated = false;
    // try {
    //     isAuthenticated = await AuthModule.checkAuthStatus(); // Or apiClient.getSession()
    //     console.log("Auth check completed. Is authenticated:", isAuthenticated);
    // } catch (authErr) {
    //     console.error("Error during initial auth check:", authErr);
    //     isAuthenticated = false;
    // }

    // --- Handle Auth Callback (if this was a redirect from login) (Handled Above) ---
    // handleAuthCallback();

    // --- Fetch Initial Election Status and User Vote Status (if authenticated) (Handled Above) ---
    // This logic is integrated into the main auth/election flow above.
    // let electionStatusFetched = false;
    // if (isAuthenticated) {
    //     try {
    //         const statusResponse = await ElectionAPI.getElectionStatus(); // Or apiClient.getElectionStatus()
    //         window.State.electionOpen = statusResponse.is_open !== undefined ? statusResponse.is_open : true;
    //         window.State.electionStartTime = statusResponse.start_time|| null;
    //         window.State.electionEndTime = statusResponse.end_time|| null;
    //         window.State.userHasVoted = (window.State.currentUser && window.State.currentUser.hasVoted) ?
    //             window.State.currentUser.hasVoted : false;
    //         electionStatusFetched = true;
    //         console.log("Initial election status and user vote status fetched.");
    //     } catch (err) {
    //         console.error('Error fetching initial election status or user vote status:', err);
    //         window.State.electionOpen = false;
    //         window.State.userHasVoted = false;
    //         if (typeof Utils !== 'undefined' && typeof Utils.showMessage === 'function') {
    //             Utils.showMessage('<span data-i18n="core.statusLoadError">Could not load election status. Defaulting to closed.</span>', 'error');
    //         }
    //     }
    // }

    // --- Conditional Tab Switching Logic (Conceptual - handled in updateVotingTabContent) ---
    // The logic for showing different messages/cards in the voting tab is now in `updateVotingTabContent`.
    // The redirect to the 'info' tab if the election is closed can be handled there or here.
    // if (isAuthenticated && electionStatusFetched && !window.State.electionOpen && window.State.userHasVoted === false) {
    //     console.log("Election is closed and user hasn't voted. Redirecting to 'info' tab.");
    //     setTimeout(() => {
    //         if (typeof UIController !== 'undefined' && UIController.switchTab) {
    //             UIController.switchTab('info');
    //             console.log("Switched to 'info' tab due to closed election.");
    //         } else {
    //             console.warn("UIController not ready or switchTab method missing when trying to redirect to 'info' tab.");
    //         }
    //     }, 150);
    // }

});
