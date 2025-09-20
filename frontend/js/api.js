class APIClient {
    constructor() {
        this.baseURL = '/api';
        this.electionId = null;
    }

    // Set the current election ID
    setCurrentElectionId(electionId) {
        if (!electionId || typeof electionId !== 'string') {
            throw new Error('Invalid election ID');
        }
        this.electionId = electionId;
    }

    // Get the current election ID
    getCurrentElectionId() {
        return this.electionId;
    }

    // Get list of elections accessible to the user
    async getElections() {
        try {
            const response = await fetch(`${this.baseURL}/elections`, {
                method: 'GET',
                credentials: 'include'
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

    // Create a new election
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

    // Generic request method for election-specific endpoints
    async _makeRequest(endpoint, options = {}) {
        if (!this.electionId) {
            throw new Error('No election selected. Please select an election first.');
        }

        const url = `${this.baseURL}/elections/${this.electionId}${endpoint}`;
        options.credentials = options.credentials || 'include';

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            // Attempt to parse JSON, but allow for non-JSON responses
            try {
                return await response.json();
            } catch (parseError) {
                console.warn(`Could not parse JSON for ${url}, returning raw response.`);
                return response;
            }
        } catch (error) {
            console.error(`API Error for ${url}:`, error);
            throw error;
        }
    }

    // Candidate Endpoints
    async getCandidates() {
        return this._makeRequest('/candidates');
    }

    // Vote Endpoints
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

    // Results Endpoint
    async getResults() {
        return this._makeRequest('/results');
    }

    // Election Status Endpoint
    async getElectionStatus() {
        return this._makeRequest('/election/status');
    }

    // Admin Endpoints
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

    // Export Votes (JSON)
    async exportVotes() {
        const response = await this._makeRequest('/admin/votes/export', {
            method: 'GET'
        });
        return response;
    }

    // Export Votes (CSV)
    async exportVotesToCSV() {
        const response = await this._makeRequest('/admin/votes/export/csv', {
            method: 'GET'
        });
        return response;
    }

    // Session Endpoint (Global)
    async getSession() {
        try {
            const response = await fetch(`${this.baseURL}/auth/session`, {
                method: 'GET',
                credentials: 'include'
            });
            if (response.status === 401) {
                return { authenticated: false };
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error fetching session:', error);
            return { authenticated: false };
        }
    }

    // Logout Endpoint (Global)
    async logout() {
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

    // Demo Auth Endpoint (Global)
    async demoAuth() {
        try {
            const response = await fetch(`${this.baseURL}/auth/demo`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error during demo auth:', error);
            throw error;
        }
    }

    // Translations Endpoint (Global)
    async getTranslations() {
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
