// js/auth.js - Authentication Module (Multi-Election Version)
// (Assuming the structure from the provided full updated file, correcting the demoAuth call)

const AuthModule = {
    // --- MODIFIED: Simplified checkAuthStatus to use apiClient ---
    checkAuthStatus: async function () {
        console.log("AuthModule.checkAuthStatus: Initiating session check...");
        try {
            // getSession is global, so using apiClient is correct
            const sessionData = await apiClient.getSession();
            console.log("AuthModule.checkAuthStatus: Session data received:", sessionData);
            if (sessionData.authenticated) {
                window.State.currentUser = sessionData.user;
                console.log("AuthModule.checkAuthStatus: User is authenticated:", window.State.currentUser);
                return true;
            } else {
                console.log("AuthModule.checkAuthStatus: User is not authenticated.");
                window.State.currentUser = null;
                return false;
            }
        } catch (error) {
            console.error("AuthModule.checkAuthStatus: Error occurred:", error);
            window.State.currentUser = null;
            throw error;
        }
    },

    // --- MODIFIED: signInWithGoogle now triggers backend redirect ---
    signInWithGoogle: async function () {
        console.log("AuthModule.signInWithGoogle: Initiating Google Sign-In...");
        try {
            const googleSigninBtn = document.getElementById('googleSigninBtn');
            const authSkeletonScreen = document.getElementById('authSkeletonScreen');

            if (googleSigninBtn) {
                googleSigninBtn.disabled = true;
                googleSigninBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span data-i18n="auth.redirecting">Redirecting...</span>';
                if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                    I18nModule.applyTranslations(googleSigninBtn);
                }
            }
            if (authSkeletonScreen) {
                authSkeletonScreen.style.display = 'flex';
            }

            window.location.href = '/auth/google/login';

        } catch (error) {
            console.error("AuthModule.signInWithGoogle: Error:", error);
            alert("An error occurred during sign-in initiation. Please try again.");
            const googleSigninBtn = document.getElementById('googleSigninBtn');
            if (googleSigninBtn) {
                googleSigninBtn.disabled = false;
                googleSigninBtn.innerHTML = '<i class="fab fa-google"></i> <span data-i18n="signInWithGoogle">Sign in with Google</span>';
                if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                    I18nModule.applyTranslations(googleSigninBtn);
                }
            }
            const authSkeletonScreen = document.getElementById('authSkeletonScreen');
            if (authSkeletonScreen) {
                authSkeletonScreen.style.display = 'none';
            }
        }
    },

    // --- MODIFIED: logout now uses apiClient ---
    logout: async function () {
        console.log("AuthModule.logout: Initiating logout...");
        try {
            // logout is global, so using apiClient is correct
            const response = await apiClient.logout();
            console.log("AuthModule.logout: Logout successful:", response);
            window.State.currentUser = null;
            window.State.currentElectionId = null;
            apiClient.setCurrentElectionId(null);
            localStorage.removeItem('selectedElectionId');
            localStorage.removeItem('hasSeenVotingInstructions');
            window.location.reload();
        } catch (error) {
            console.error("AuthModule.logout: Error occurred:", error);
            alert("An error occurred during logout. Redirecting to login.");
            window.State.currentUser = null;
            window.State.currentElectionId = null;
            apiClient.setCurrentElectionId(null);
            localStorage.removeItem('selectedElectionId');
            localStorage.removeItem('hasSeenVotingInstructions');
            window.location.reload();
        }
    },

    // --- CORRECTED: Demo Authentication - Uses direct fetch for global endpoint ---
    demoAuth: async function () {
        console.log("AuthModule.demoAuth: Initiating demo login...");
        const demoBtn = document.getElementById('demoAuthBtn');
        const authSkeletonScreen = document.getElementById('authSkeletonScreen');

        let originalBtnContent = '';
        if (demoBtn) {
            originalBtnContent = demoBtn.innerHTML;
            demoBtn.innerHTML = '<div class="loader" style="width: 20px; height: 20px; border-width: 2px;"></div> <span data-i18n="auth.enteringDemo">Entering Demo...</span>';
            demoBtn.disabled = true;
            if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                I18nModule.applyTranslations(demoBtn);
            }
        }

        if (authSkeletonScreen) {
            authSkeletonScreen.style.display = 'flex';
        }

        try {
            // --- CORRECTION: Use direct fetch for the global /api/auth/demo endpoint ---
            // Do NOT use apiClient._makeRequest as it requires an electionId
            const response = await fetch('/api/auth/demo', {
                 method: 'POST',
                 credentials: 'include', // Include cookies/session - crucial for authentication
                 headers: {
                     'Content-Type': 'application/json' // Good practice for POST requests
                 }
                 // No body needed for demo auth creation
            });

            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({}));
                 throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("AuthModule.demoAuth: Demo login response:", data);

            if (data.authenticated) {
                window.State.currentUser = data.user;
                console.log("AuthModule.demoAuth: Demo login successful for:", window.State.currentUser);

                // Store the demo election ID provided by the backend
                if (data.demo_election_id) {
                     window.demoElectionId = data.demo_election_id;
                     console.log("AuthModule.demoAuth: Demo election ID received:", window.demoElectionId);
                }

                // Reload the page to trigger the main initialization flow in core-main.js
                // which will check auth status, find the demo election ID,
                // and proceed accordingly.
                window.location.reload();

            } else {
                throw new Error(data.message || "Demo login failed");
            }
        } catch (error) {
            console.error("AuthModule.demoAuth: Error:", error);
            if (typeof Utils !== 'undefined' && typeof Utils.showMessage === 'function') {
                 Utils.showMessage(`auth.demoFailed|${error.message}`, 'error');
            } else {
                 alert("Demo login failed: " + (error.message || "Unknown error"));
            }

            if (authSkeletonScreen) {
                authSkeletonScreen.style.display = 'none';
            }
        } finally {
            if (demoBtn) {
                demoBtn.innerHTML = originalBtnContent;
                demoBtn.disabled = false;
            }
        }
    }
};

window.AuthModule = AuthModule;

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('googleSigninBtn')?.addEventListener('click', function (e) {
        e.preventDefault();
        AuthModule.signInWithGoogle();
    });

    document.getElementById('demoAuthBtn')?.addEventListener('click', function (e) {
        e.preventDefault();
        AuthModule.demoAuth();
    });
});
