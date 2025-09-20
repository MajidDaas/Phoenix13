// js/api.js

class APIClient {
    constructor() {
        this.baseURL = '/api'; // Base URL for API endpoints
        this.electionId = null; // Store the current election ID
    }

    // --- NEW: Set the current election ID ---
    setCurrentElectionId(electionId) {
        this.electionId = electionId;
    }

    // --- NEW: Get the current election ID ---
    getCurrentElectionId() {
        return this.electionId;
    }

    // --- NEW: Get list of elections accessible to the user ---
    async getElections() {
        try {
            const response = await fetch(`${this.baseURL}/elections`, {
                method: 'GET',
                credentials: 'include' // Include cookies/session
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error fetching elections:', error);
            throw error;
        }
    }

    // --- NEW: Create a new election ---
    async createElection(electionData) {
        try {
            const response = await fetch(`${this.baseURL}/elections`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(electionData)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error creating election:', error);
            throw error;
        }
    }

    // --- MODIFIED: Generic request method to include election ID where needed ---
    async _makeRequest(endpoint, options = {}) {
        if (!this.electionId) {
             console.error('No election ID set for API request:', endpoint);
             throw new Error('No election selected. Please select an election first.');
        }

        const url = `${this.baseURL}/elections/${this.electionId}${endpoint}`;
        // Ensure credentials are included
        options.credentials = options.credentials || 'include';

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            // Attempt to parse JSON, but allow for non-JSON responses (like file exports)
            try {
                return await response.json();
            } catch (parseError) {
                // If parsing fails, return the raw response (useful for file downloads)
                console.warn(`Could not parse JSON for ${url}, returning raw response.`);
                return response;
            }
        } catch (error) {
            console.error(`API Error for ${url}:`, error);
            throw error;
        }
    }

    // --- MODIFIED: Candidate Endpoints ---
    async getCandidates() {
        return this._makeRequest('/candidates');
    }

    // --- MODIFIED: Vote Endpoints ---
    async submitVote(selectedCandidates, executiveCandidates) {
        const data = {
            selectedCandidates: selectedCandidates,
            executiveCandidates: executiveCandidates
        };
        return this._makeRequest('/votes/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    }

    // --- MODIFIED: Results Endpoint ---
    async getResults() {
        return this._makeRequest('/results');
    }

    // --- MODIFIED: Election Status Endpoint ---
    async getElectionStatus() {
        return this._makeRequest('/election/status');
    }

    // --- MODIFIED: Admin Endpoints ---
    async getAdminCandidates() {
        return this._makeRequest('/admin/candidates');
    }

    async addCandidate(candidateData) {
        return this._makeRequest('/admin/candidates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(candidateData)
        });
    }

    async deleteCandidate(candidateId) {
        return this._makeRequest(`/admin/candidates/${candidateId}`, {
            method: 'DELETE'
        });
    }

    async toggleElection() {
        return this._makeRequest('/admin/election/toggle', {
            method: 'POST'
        });
    }

    async scheduleElection(startTime, endTime) {
        const data = {
            start_time: startTime,
            end_time: endTime
        };
        return this._makeRequest('/admin/election/schedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    }

    // --- MODIFIED: Export Votes (JSON) ---
    // This returns the raw fetch Response object for file handling
    async exportVotes() {
        // _makeRequest handles the URL construction and error checking
        // but we return the raw response for file download handling
        const response = await this._makeRequest('/admin/votes/export', {
             method: 'GET',
             // Do not set Content-Type for GET requests fetching a file
        });
        // The _makeRequest catch block handles HTTP errors
        // Return the raw response object for the caller to handle (e.g., blob())
        return response;
    }

    // --- MODIFIED: Export Votes (CSV) ---
    // This also returns the raw fetch Response object
    async exportVotesToCSV() {
         const response = await this._makeRequest('/admin/votes/export/csv', {
             method: 'GET',
             // Do not set Content-Type for GET requests fetching a file
         });
         // The _makeRequest catch block handles HTTP errors
         return response;
    }

    // --- MODIFIED: Session Endpoint (Global, no election ID needed) ---
    async getSession() {
        // This endpoint is global, not election-specific
        try {
            const response = await fetch(`${this.baseURL}/auth/session`, {
                method: 'GET',
                credentials: 'include'
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // If it's a 401, it just means not authenticated, which is not an error to throw
                if(response.status === 401) {
                    return { authenticated: false };
                }
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error fetching session:', error);
            // Re-throw for global error handling if needed, or return a default unauthenticated state
            throw error;
            // Or, return a default: return { authenticated: false };
        }
    }

    // --- MODIFIED: Logout Endpoint (Global, no election ID needed) ---
     async logout() {
         // This endpoint is global, not election-specific
         try {
             const response = await fetch(`${this.baseURL}/auth/logout`, {
                 method: 'POST',
                 credentials: 'include'
             });
             if (!response.ok) {
                 const errorData = await response.json().catch(() => ({}));
                 throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
             }
             return await response.json();
         } catch (error) {
             console.error('API Error during logout:', error);
             throw error;
         }
     }

    // --- MODIFIED: Translations Endpoint (Global, no election ID needed) ---
    async getTranslations() {
        // This endpoint is global, not election-specific
        try {
            const response = await fetch(`${this.baseURL}/translations`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error fetching translations:', error);
            throw error;
        }
    }
}

// Create a global instance of the API client
const apiClient = new APIClient();
