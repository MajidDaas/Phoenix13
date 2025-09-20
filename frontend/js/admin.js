// js/admin.js - Admin Module

const AdminModule = {
    // --- MODIFIED: Load Admin Candidates using apiClient ---
    loadAdminCandidates: async function () {
        console.log("AdminModule.loadAdminCandidates: Fetching admin candidates...");
        // This function is called by UIController.switchTab('admin') in core-main.js
        // It should load candidates into the #existingCandidatesList element
        await CandidateManager.loadCandidates({ isAdmin: true });
    },

    // --- MODIFIED: Add Candidate using apiClient ---
    addCandidate: async function (formData) {
        console.log("AdminModule.addCandidate: Preparing to add candidate...");
        const submitBtn = document.querySelector('#addCandidateForm button[type="submit"]');
        const resetBtn = document.querySelector('#addCandidateForm button[type="reset"]');

        try {
            if (submitBtn) {
                const originalHtml = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
            }
            if (resetBtn) resetBtn.disabled = true;

            // Extract data from FormData
            const candidateData = {};
            for (let [key, value] of formData.entries()) {
                // Map form field names to internal API names if they differ
                // Based on the form in index.html and models.py
                let internalKey = key;
                switch(key) {
                    case 'candidateName': internalKey = 'name'; break;
                    case 'candidatePhoto': internalKey = 'photo'; break;
                    case 'candidateBriefBio': internalKey = 'bio'; break;
                    case 'candidateBio': internalKey = 'biography'; break;
                    case 'candidateFieldOfActivity': internalKey = 'field_of_activity'; break;
                    case 'candidateActivity': internalKey = 'activity'; value = parseInt(value, 10) || 0; break;
                    case 'candidateFullName': internalKey = 'full_name'; break;
                    case 'candidateEmail': internalKey = 'email'; break;
                    case 'candidatePhone': internalKey = 'phone'; break;
                    case 'candidatePoB': internalKey = 'place_of_birth'; break;
                    case 'candidatePoResidence': internalKey = 'residence'; break;
                    case 'candidateDoB': internalKey = 'date_of_birth'; break;
                    case 'candidateWork': internalKey = 'work'; break;
                    case 'candidateEducation': internalKey = 'education'; break;
                    case 'candidateFacebook': internalKey = 'facebook_url'; break;
                    // Default: use the form field name as the internal key
                }
                // Only add non-empty values
                if (value !== null && value !== undefined && value !== '') {
                     // For activity, ensure it's a number
                     if (internalKey === 'activity') {
                         candidateData[internalKey] = parseInt(value, 10);
                     } else {
                         candidateData[internalKey] = value.toString().trim();
                     }
                }
            }

            console.log("AdminModule.addCandidate: Candidate data prepared:", candidateData);

            // Basic client-side validation for required fields
            if (!candidateData.name || !candidateData.photo || !candidateData.bio || !candidateData.field_of_activity || candidateData.activity === undefined) {
                throw new Error("Please fill in all required fields (Name, Photo URL, Brief Bio, Field of Activity, Activity).");
            }

            // --- MODIFIED: Use apiClient to add candidate ---
            const response = await apiClient.addCandidate(candidateData); // Uses apiClient
            console.log("AdminModule.addCandidate: API response:", response);

            if (response && response.message) {
                Utils.showMessage(response.message, 'success');
                // Reset the form
                document.getElementById('addCandidateForm')?.reset();
                // Reload the admin candidate list
                // --- MODIFIED: Use apiClient-aware load function ---
                if (typeof CandidateManager !== 'undefined' && typeof CandidateManager.loadCandidates === 'function') {
                    await CandidateManager.loadCandidates({ isAdmin: true });
                } else {
                    console.warn("CandidateManager.loadCandidates not found after adding candidate.");
                }
            } else {
                Utils.showMessage('admin.unexpectedResponse', 'error');
            }

        } catch (error) {
            console.error('AdminModule.addCandidate: Error:', error);
            if (error instanceof TypeError && error.message.includes('fetch')) {
                Utils.showMessage('admin.networkError', 'error');
            } else {
                Utils.showMessage(`Error adding candidate: ${error.message}`, 'error');
            }
        } finally {
            // Re-enable buttons
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> <span data-i18n="addCandidate">Add Candidate</span>';
                if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                    I18nModule.applyTranslations(submitBtn);
                }
            }
            if (resetBtn) resetBtn.disabled = false;
        }
    },

    // --- MODIFIED: Toggle Election using apiClient ---
    toggleElection: async function () {
        console.log("AdminModule.toggleElection: Toggling election status...");
        const toggleBtn = document.getElementById('toggleElectionBtn');
        try {
            if (toggleBtn) {
                const originalHtml = toggleBtn.innerHTML;
                toggleBtn.disabled = true;
                toggleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            }

            // --- MODIFIED: Use apiClient to toggle election ---
            const response = await apiClient.toggleElection(); // Uses apiClient
            console.log("AdminModule.toggleElection: API response:", response);

            if (response && response.message) {
                Utils.showMessage(response.message, 'success');
                // Update frontend state
                window.State.electionOpen = response.is_open;
                console.log("AdminModule.toggleElection: Frontend electionOpen state updated to:", window.State.electionOpen);

                // Update UI elements that reflect election status
                // This is also handled by the timer in core-main.js, but update immediately for responsiveness
                if (typeof updateElectionStatusDisplay === 'function') {
                     updateElectionStatusDisplay();
                }

                // Update button text and style based on new status
                if (toggleBtn) {
                    const icon = toggleBtn.querySelector('i');
                    toggleBtn.classList.remove('scale-animation');
                    if (response.is_open) {
                        toggleBtn.innerHTML = '<i class="fas fa-stop-circle"></i> <span data-i18n="admin.closeElection">Close Election</span>';
                    } else {
                        toggleBtn.innerHTML = '<i class="fas fa-play-circle"></i> <span data-i18n="admin.openElection">Open Election</span>';
                    }
                    // Re-apply translations
                    if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                        I18nModule.applyTranslations(toggleBtn);
                    }
                    // Add animation class
                    setTimeout(() => toggleBtn.classList.add('scale-animation'), 10);
                }

                // Refresh other relevant parts of the UI if needed
                if (window.ResultsModule && typeof window.ResultsModule.loadResults === 'function') {
                    window.ResultsModule.loadResults();
                }

            } else {
                Utils.showMessage('admin.unexpectedResponse', 'error');
            }

        } catch (error) {
            console.error("AdminModule.toggleElection: Error:", error);
            Utils.showMessage(`admin.backendNotice: ${error.message}`, 'error');
        } finally {
            if (toggleBtn) {
                toggleBtn.disabled = false;
                // Text is set above, just ensure spinner is gone if error happened early
                if (toggleBtn.innerHTML.includes('fa-spinner')) {
                     // Fallback if error was before text update
                     toggleBtn.innerHTML = window.State.electionOpen ?
                         '<i class="fas fa-stop-circle"></i> <span data-i18n="admin.closeElection">Close Election</span>' :
                         '<i class="fas fa-play-circle"></i> <span data-i18n="admin.openElection">Open Election</span>';
                     if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                         I18nModule.applyTranslations(toggleBtn);
                     }
                }
            }
        }
    },

    // --- MODIFIED: Schedule Election using apiClient ---
    scheduleElection: async function () {
        console.log("AdminModule.scheduleElection: Scheduling election...");
        const startInput = document.getElementById('electionStart');
        const endInput = document.getElementById('electionEnd');

        if (!startInput || !endInput) {
            console.error("AdminModule.scheduleElection: Start or End time input not found.");
            Utils.showMessage("Schedule inputs not found.", 'error');
            return;
        }

        const startTimeStr = startInput.value;
        const endTimeStr = endInput.value;

        if (!startTimeStr || !endTimeStr) {
            Utils.showMessage("admin.scheduleElection.missingTimes", 'warning');
            return;
        }

        try {
            // --- MODIFIED: Use apiClient to schedule election ---
            const response = await apiClient.scheduleElection(startTimeStr, endTimeStr); // Uses apiClient
            console.log("AdminModule.scheduleElection: API response:", response);

            if (response && response.message) {
                Utils.showMessage(response.message, 'success');
                // Update frontend state with new schedule
                window.State.electionStartTime = response.start_time || null;
                window.State.electionEndTime = response.end_time || null;
                // Update display
                if (typeof updateElectionStatusDisplay === 'function') {
                    updateElectionStatusDisplay();
                }
            } else {
                Utils.showMessage('admin.scheduleFailed', 'error');
            }
        } catch (error) {
            console.error("AdminModule.scheduleElection: Error:", error);
            Utils.showMessage(`admin.backendNotice: ${error.message}`, 'error');
        }
    },

    // --- MODIFIED: Export Votes (JSON) using apiClient ---
    exportVotes: async function () {
        console.log("AdminModule.exportVotes: Initiating JSON export...");
        const exportBtn = document.getElementById('exportVotesBtn');
        try {
            if (exportBtn) {
                const originalHtml = exportBtn.innerHTML;
                exportBtn.disabled = true;
                exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span data-i18n="admin.exporting">Exporting...</span>';
                if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                    I18nModule.applyTranslations(exportBtn);
                }
            }

            // --- MODIFIED: Use apiClient to export votes ---
            // apiClient.exportVotes now returns the raw fetch Response object
            const response = await apiClient.exportVotes(); // Uses apiClient
            console.log("AdminModule.exportVotes: API Response object received:", response);

            if (!response.ok) {
                 throw new Error(`Export failed with status ${response.status}: ${response.statusText}`);
            }

            // Get filename from Content-Disposition header
            let filename = 'votes_export.json';
            const contentDisposition = response.headers.get('Content-Disposition');
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=]*=((['"]).*?\2|[^;]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                }
            }

            // Convert response body to blob
            const blob = await response.blob();
            console.log("AdminModule.exportVotes: Blob created.");

            // Create download link and trigger download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            Utils.showMessage('admin.votesExported', 'success');
        } catch (error) {
            console.error("AdminModule.exportVotes: Error:", error);
            Utils.showMessage(`admin.exportVotesFailed: ${error.message}`, 'error');
        } finally {
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.innerHTML = '<i class="fas fa-file-code"></i> <span data-i18n="exportAsJSON">Export Votes (JSON)</span>';
                if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                    I18nModule.applyTranslations(exportBtn);
                }
            }
        }
    },

    // --- MODIFIED: Export Votes (CSV) using apiClient ---
    exportVotesToCSV: async function () {
        console.log("AdminModule.exportVotesToCSV: Initiating CSV export...");
        const exportCSVBtn = document.getElementById('exportVotesToCSVBtn');
        try {
            if (exportCSVBtn) {
                const originalHtml = exportCSVBtn.innerHTML;
                exportCSVBtn.disabled = true;
                exportCSVBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span data-i18n="admin.exporting">Exporting...</span>';
                if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                    I18nModule.applyTranslations(exportCSVBtn);
                }
            }

            // --- MODIFIED: Use apiClient to export votes to CSV ---
            const response = await apiClient.exportVotesToCSV(); // Uses apiClient
            console.log("AdminModule.exportVotesToCSV: API Response object received:", response);

            if (!response.ok) {
                 throw new Error(`CSV Export failed with status ${response.status}: ${response.statusText}`);
            }

             // Get filename from Content-Disposition header
             let filename = 'votes_export.csv';
             const contentDisposition = response.headers.get('Content-Disposition');
             if (contentDisposition) {
                 const filenameMatch = contentDisposition.match(/filename[^;=]*=((['"]).*?\2|[^;]*)/);
                 if (filenameMatch && filenameMatch[1]) {
                     filename = filenameMatch[1].replace(/['"]/g, '');
                 }
             }

            // Convert response body to blob
            const blob = await response.blob();
            console.log("AdminModule.exportVotesToCSV: CSV Blob created.");

            // Create download link and trigger download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            Utils.showMessage('admin.votesExportedCSV', 'success');
        } catch (error) {
            console.error("AdminModule.exportVotesToCSV: Error:", error);
            Utils.showMessage(`admin.exportVotesCSVFailed: ${error.message}`, 'error');
        } finally {
            if (exportCSVBtn) {
                exportCSVBtn.disabled = false;
                exportCSVBtn.innerHTML = '<i class="fas fa-file-csv"></i> <span data-i18n="exportAsCSV">Export Votes (CSV)</span>';
                if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                    I18nModule.applyTranslations(exportCSVBtn);
                }
            }
        }
    },

    // Placeholder functions (not implemented in backend)
    refreshData: async function () {
        Utils.showMessage('admin.dataRefreshed', 'success');
        // Could trigger reload of candidates, results, etc.
    },
    backupToCloud: async function () {
        Utils.showMessage('admin.dataBackedUp', 'success');
        // Placeholder
    },

    // --- MODIFIED: Update Admin UI based on user role (conceptual, handled more in core-main.js) ---
    updateAdminUIForLoggedInUser: function (user) {
        console.log("AdminModule.updateAdminUIForLoggedInUser: Updating UI for user:", user);
        // This logic is largely handled in core-main.js based on the election context
        // when the election is selected and the user's role for that election is known.
        // This function might be used for other dynamic admin UI updates if needed.
    }
};

// Expose the module globally
window.AdminModule = AdminModule;
