const API_BASE_URL = 'https://prn-nurse-backend.vercel.app/api';

const api = {
    // Auth & JWT Management
    getToken: () => localStorage.getItem('adminToken'),
    setToken: (token) => localStorage.setItem('adminToken', token),
    logout: () => {
        localStorage.removeItem('adminToken');
        window.location.reload();
    },

    // Base Fetcher
    async fetchAPI(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });
            const data = await response.json();
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.logout(); // Token expired or invalid
                }
                throw new Error(data.message || 'API Error');
            }
            return data;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    },

    // 1. Authentication
    async login(email, password) {
        return this.fetchAPI('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },

    // 2. Metrics & Dashboard
    async getMetrics() {
        return this.fetchAPI('/admin/metrics');
    },

    // 3. Nurse Verifications
    async getPendingVerifications() {
        return this.fetchAPI('/admin/verifications');
    },
    async updateVerificationStatus(nurseId, status, comments = '') {
        return this.fetchAPI(`/admin/verifications/${nurseId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status, comments })
        });
    },

    // 4. Bookings
    async getAllBookings() {
        return this.fetchAPI('/admin/bookings');
    },

    // 5. Safety & Incidents
    async getIncidents() {
        return this.fetchAPI('/admin/incidents');
    },

    // 6. Emergencies
    async getEmergencies() {
        return this.fetchAPI('/admin/emergencies');
    },
    async escalateEmergency(emergencyId, resolutionNotes) {
        return this.fetchAPI(`/admin/emergencies/${emergencyId}/escalate`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'Escalated to Services', resolutionNotes })
        });
    },

    // 7. System Health
    async getSystemHealth() {
        return this.fetchAPI('/admin/health');
    }
};
