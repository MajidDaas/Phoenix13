const AuthModule = {
    // Check authentication status
    checkAuthStatus: async function () {
        console.log("AuthModule.checkAuthStatus: Initiating session check...");
        try {
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
            return false;
        }
    },

    // Sign in with Google
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
            this.showAuthError("An error occurred during sign-in initiation. Please try again.");
            this.resetAuthButtons();
        }
    },

    // Logout
    logout: async function () {
        console.log("AuthModule.logout: Initiating logout...");
        try {
            const response = await apiClient.logout();
            console.log("AuthModule.logout: Logout successful:", response);
            this.clearAuthState();
            window.location.reload();
        } catch (error) {
            console.error("AuthModule.logout: Error occurred:", error);
            this.showAuthError("An error occurred during logout. Redirecting to login.");
            this.clearAuthState();
            window.location.reload();
        }
    },

    // Demo Authentication
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
            const data = await apiClient.demoAuth();
            console.log("AuthModule.demoAuth: Demo login response:", data);

            if (data.authenticated) {
                window.State.currentUser = data.user;
                console.log("AuthModule.demoAuth: Demo login successful for:", window.State.currentUser);

                if (data.demo_election_id) {
                    window.demoElectionId = data.demo_election_id;
                    console.log("AuthModule.demoAuth: Demo election ID received:", window.demoElectionId);
                }

                window.location.reload();
            } else {
                throw new Error(data.message || "Demo login failed");
            }
        } catch (error) {
            console.error("AuthModule.demoAuth: Error:", error);
            this.showAuthError(`Demo login failed: ${error.message || 'Unknown error'}`);
        } finally {
            if (authSkeletonScreen) {
                authSkeletonScreen.style.display = 'none';
            }
            if (demoBtn) {
                demoBtn.innerHTML = originalBtnContent;
                demoBtn.disabled = false;
            }
        }
    },

    // Helper methods
    clearAuthState: function() {
        window.State.currentUser = null;
        window.State.currentElectionId = null;
        apiClient.setCurrentElectionId(null);
        localStorage.removeItem('selectedElectionId');
        localStorage.removeItem('hasSeenVotingInstructions');
        localStorage.removeItem('language');
    },

    showAuthError: function(message) {
        if (typeof Utils !== 'undefined' && typeof Utils.showMessage === 'function') {
            Utils.showMessage(message, 'error');
        } else {
            alert(message);
        }
    },

    resetAuthButtons: function() {
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
};

window.AuthModule = AuthModule;

document.addEventListener('DOMContentLoaded', function () {
    const googleBtn = document.getElementById('googleSigninBtn');
    const demoBtn = document.getElementById('demoAuthBtn');
    
    if (googleBtn) {
        googleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (typeof AuthModule !== 'undefined' && AuthModule.signInWithGoogle) {
                AuthModule.signInWithGoogle();
            }
        });
    }

    if (demoBtn) {
        demoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (typeof AuthModule !== 'undefined' && AuthModule.demoAuth) {
                AuthModule.demoAuth();
            }
        });
    }
});
