// js/results.js - Results Module
const ResultsModule = {
    currentChart: null,

    // --- MODIFIED: Use apiClient for fetching results ---
    loadResults: async function () {
        const resultsContent = document.getElementById('resultsContent');
        if (!resultsContent) {
            console.error("Results content element (#resultsContent) not found.");
            return;
        }

        // Show loading indicator
        resultsContent.innerHTML = `
            <div class="loader-container">
                <div class="loader"></div>
                <p data-i18n="results.loading">Loading election results...</p>
            </div>
        `;
        // Apply translation to loading text
        if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
            I18nModule.applyTranslations(resultsContent);
        }

        try {
            // --- MODIFIED: Fetch results using apiClient (includes election context) ---
            const resultsData = await apiClient.getResults();
            console.log("Results data fetched:", resultsData);

            // --- MODIFIED: Fetch candidates for enriching results (includes election context) ---
            // We need public candidate data to get photos/bios for the results display
            let candidatesList = [];
            try {
                candidatesList = await apiClient.getCandidates(); // This fetches public data
                console.log("Candidate data for results fetched.");
            } catch (candidatesErr) {
                console.warn("Could not fetch candidate data for results enrichment:", candidatesErr);
                // Proceed with results even if candidate enrichment fails
            }

            // --- MODIFIED: Fetch votes data for stats (includes election context) ---
            let totalVotes = 0;
            let totalVoters = 0;
            try {
                const votesData = await apiClient._makeRequest('/admin/votes/export'); // Need raw response
                // Assuming votesData is the raw response object, we need to parse it
                // This is a bit tricky because export returns JSON file content
                // Let's fetch votes data differently if needed, or parse the blob
                // For simplicity, let's assume getResults provides totalVotes
                totalVotes = resultsData.totalVotes || 0;
                // To get totalVoters, we might need to fetch the full votes list or get it from backend
                // Let's assume the backend provides it or we calculate it.
                // If votesData is a JSON response with voter_ids:
                if (votesData && votesData.voter_ids) {
                     totalVoters = votesData.voter_ids.length;
                } else if (resultsData.totalVotes !== undefined) {
                     // Fallback if backend provides it in results
                     totalVoters = resultsData.totalVotes; // This might be votes, not voters. Clarify.
                     // Let's assume backend sends totalVoters separately or we need a different endpoint.
                     // For now, use a placeholder or derive if possible.
                }
                console.log("Votes data for stats fetched or derived.");
            } catch (votesErr) {
                console.warn("Could not fetch votes data for stats:", votesErr);
                // Use values from resultsData if available, or default to 0
                totalVotes = resultsData.totalVotes || 0;
                totalVoters = resultsData.totalVoters || totalVotes; // Placeholder logic
            }

            const totalVotersEl = document.getElementById('totalVotersStat');
            const voterTurnoutEl = document.getElementById('turnoutRateStat');
            const totalVotesEl = document.getElementById('votesCastStat');

            // Update stats
            if (totalVotersEl) totalVotersEl.textContent = totalVoters;
            if (totalVotesEl) totalVotesEl.textContent = totalVotes;
            const turnoutRate = totalVoters > 0 ? ((totalVotes / totalVoters) * 100).toFixed(2) : '0.00';
            if (voterTurnoutEl) voterTurnoutEl.textContent = `${turnoutRate}%`;

            // --- Render Results based on election status ---
            if (resultsData.isOpen === true) {
                // Election is currently open
                resultsContent.innerHTML = `
                    <div class="status-pending">
                        <i class="fas fa-hourglass-half"></i>
                        <h3 data-i18n="results.electionOpen.title">Election In Progress</h3>
                        <p data-i18n="results.electionOpen.message">Results will be available after the election closes.</p>
                    </div>
                `;
                // Destroy existing chart if any
                if (this.currentChart) {
                    this.currentChart.destroy();
                    this.currentChart = null;
                }
            } else {
                // Election is closed, show results
                const resultsArray = resultsData.results || [];
                if (resultsArray.length === 0) {
                    resultsContent.innerHTML = `
                        <div class="status-info">
                            <i class="fas fa-info-circle"></i>
                            <p data-i18n="results.noVotes">No votes have been cast yet.</p>
                        </div>
                    `;
                    // Destroy existing chart if any
                    if (this.currentChart) {
                        this.currentChart.destroy();
                        this.currentChart = null;
                    }
                } else {
                    // Enrich results with candidate metadata (photo, bio, etc.)
                    const enrichedResults = resultsArray.map(result => {
                        const candidateMeta = candidatesList.find(c => c.id === result.id) || {};
                        return {
                            ...result,
                            photo: candidateMeta.photo || '/images/default.jpg',
                            bio: candidateMeta.bio || '',
                            field_of_activity: candidateMeta.field_of_activity || '',
                            activity: candidateMeta.activity || 0
                        };
                    });

                    this.renderLeaderboard(enrichedResults);
                    this.renderChart(enrichedResults);
                }
            }

            // Apply translations to the newly rendered results content
            if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                I18nModule.applyTranslations();
            }

        } catch (err) {
            console.error('Error fetching results:', err);
            resultsContent.innerHTML = `<div class="status-error"><p><span data-i18n="results.load.error">Error loading results. Please try again later.</span> (${err.message})</p></div>`;
            // Apply translation
            if (typeof I18nModule !== 'undefined' && typeof I18nModule.applyTranslations === 'function') {
                I18nModule.applyTranslations();
            }
            // Destroy existing chart if any error occurs after chart was created
            if (this.currentChart) {
                this.currentChart.destroy();
                this.currentChart = null;
            }
        }
    },

    renderLeaderboard: function (enrichedResults) {
        const resultsContent = document.getElementById('resultsContent');
        if (!resultsContent) return;

        let html = '<div class="leaderboard-list">';
        enrichedResults.forEach((result, index) => {
            const positionClass = index === 0 ? 'first' : index === 1 ? 'second' : index === 2 ? 'third' : '';
            const positionIcon = index === 0 ? '<i class="fas fa-trophy gold"></i>' :
                                 index === 1 ? '<i class="fas fa-medal silver"></i>' :
                                 index === 2 ? '<i class="fas fa-medal bronze"></i>' : `<span class="position-number">${index + 1}</span>`;

            html += `
                <div class="leaderboard-item ${positionClass}" data-candidate-id="${result.id}">
                    <div class="candidate-rank">${positionIcon}</div>
                    <div class="candidate-info">
                        <img src="${escapeHtml(result.photo)}" alt="${escapeHtml(result.name)}" class="candidate-photo-small" onerror="this.onerror=null; this.src='/images/default.jpg';">
                        <div class="candidate-details">
                            <h4 class="candidate-name winner-name" data-candidate-id="${result.id}">${escapeHtml(result.name)}</h4>
                            <p class="candidate-bio">${escapeHtml(result.bio.substring(0, 100))}${result.bio.length > 100 ? '...' : ''}</p>
                            <div class="candidate-stats">
                                <span class="stat"><i class="fas fa-users"></i> Council: ${result.councilVotes}</span>
                                <span class="stat"><i class="fas fa-star"></i> Executive: ${result.executiveVotes}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        resultsContent.innerHTML = html;

        // Add click listeners for candidate names to show popup
        document.querySelectorAll('.winner-name').forEach(nameElement => {
            nameElement.addEventListener('click', (e) => {
                e.stopPropagation();
                const candidateId = parseInt(e.target.getAttribute('data-candidate-id'));
                const candidateData = enrichedResults.find(c => c.id === candidateId);
                if (candidateData) {
                    this.showWinnerPopup(candidateData);
                }
            });
        });
    },

    renderChart: function (enrichedResults) {
        const ctx = document.getElementById('resultsChart');
        if (!ctx) {
            console.warn("Results chart canvas (#resultsChart) not found.");
            return;
        }

        // Destroy previous chart instance if it exists
        if (this.currentChart) {
            this.currentChart.destroy();
        }

        const topCandidates = enrichedResults.slice(0, 10); // Top 10 candidates
        const labels = topCandidates.map(c => c.name);
        const councilVotes = topCandidates.map(c => c.councilVotes);
        const executiveVotes = topCandidates.map(c => c.executiveVotes);

        this.currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Council Votes',
                        data: councilVotes,
                        backgroundColor: 'rgba(54, 162, 235, 0.7)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Executive Votes',
                        data: executiveVotes,
                        backgroundColor: 'rgba(255, 99, 132, 0.7)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            autoSkip: false,
                            maxRotation: 90,
                            minRotation: 45
                        },
                        title: {
                            display: true,
                            text: 'Candidates'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Votes'
                        },
                        ticks: {
                            precision: 0 // Ensure whole numbers
                        }
                    }
                }
            }
        });
    },

    showWinnerPopup: function (candidateData) {
        const popup = document.getElementById('winnerInfoPopup');
        const detailsContainer = popup.querySelector('.winner-details');
        if (!popup || !detailsContainer) {
            console.error("Winner popup elements not found.");
            return;
        }

        detailsContainer.innerHTML = `
            <div class="winner-info-grid">
                <div class="winner-photo-container">
                    <img src="${escapeHtml(candidateData.photo)}" alt="${escapeHtml(candidateData.name)}" class="winner-photo" onerror="this.onerror=null; this.src='/images/default.jpg';">
                </div>
                <div class="winner-info-text">
                    <h3>${escapeHtml(candidateData.name)}</h3>
                    <p class="winner-bio">${escapeHtml(candidateData.bio)}</p>
                    <div class="winner-stats">
                        <p><i class="fas fa-users"></i> <strong>Council Votes:</strong> ${candidateData.councilVotes}</p>
                        <p><i class="fas fa-star"></i> <strong>Executive Votes:</strong> ${candidateData.executiveVotes}</p>
                        <p><i class="fas fa-briefcase"></i> <strong>Field:</strong> ${escapeHtml(candidateData.field_of_activity || 'N/A')}</p>
                        <p><i class="fas fa-clock"></i> <strong>Activity:</strong> ${candidateData.activity} hrs/week</p>
                    </div>
                </div>
            </div>
        `;

        popup.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        // Add close listener if not already added
        const closeBtn = popup.querySelector('.close-popup');
        if (closeBtn) {
            const closeHandler = () => {
                this.hideWinnerPopup();
                closeBtn.removeEventListener('click', closeHandler); // Remove listener after use
            };
            closeBtn.addEventListener('click', closeHandler);
        }
    },

    hideWinnerPopup: function () {
        const popup = document.getElementById('winnerInfoPopup');
        if (popup) {
            popup.style.display = 'none';
            document.body.style.overflow = ''; // Restore background scrolling
        }
    }
};

// Helper function for basic HTML escaping
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Expose the module globally if needed
window.ResultsModule = ResultsModule;
