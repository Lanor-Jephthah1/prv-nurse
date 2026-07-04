document.addEventListener('DOMContentLoaded', () => {
    // Check Authentication
    const token = api.getToken();
    if (!token) {
        document.getElementById('login-overlay').classList.remove('hidden');
    } else {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        initDashboard();
    }

    // Login Logic
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('login-btn');
        const errorDiv = document.getElementById('login-error');
        
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
        btn.disabled = true;
        errorDiv.innerText = '';

        try {
            const res = await api.login(email, password);
            if (res.role !== 'admin') {
                throw new Error("Access Denied: Admin role required.");
            }
            api.setToken(res.token);
            window.location.reload();
        } catch (err) {
            errorDiv.innerText = err.message || 'Login failed';
            btn.innerHTML = '<span>Authenticate</span><i class="fa-solid fa-arrow-right"></i>';
            btn.disabled = false;
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => api.logout());

    // Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = item.getAttribute('data-view');
            
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            viewSections.forEach(v => {
                if (v.id === `view-${targetView}`) {
                    v.classList.remove('hidden');
                } else {
                    v.classList.add('hidden');
                }
            });

            // Refresh data based on view
            if (targetView === 'overview') loadOverview();
            if (targetView === 'verifications') loadVerifications();
            if (targetView === 'bookings') loadBookings();
            if (targetView === 'safety') loadIncidents();
            if (targetView === 'emergencies') loadEmergencies();
        });
    });

    // Refresh Buttons
    document.getElementById('refresh-verifications').addEventListener('click', loadVerifications);
    document.getElementById('refresh-bookings').addEventListener('click', loadBookings);
    document.getElementById('refresh-incidents').addEventListener('click', loadIncidents);
    document.getElementById('refresh-emergencies').addEventListener('click', loadEmergencies);
});

// Initialization
async function initDashboard() {
    loadOverview();
    
    // Auto refresh critical data every 30 seconds
    setInterval(() => {
        loadOverview(true);
        loadEmergencies(true);
    }, 30000);
}

// 1. Overview Loading
async function loadOverview(silent = false) {
    try {
        const metrics = await api.getMetrics();
        const health = await api.getSystemHealth();

        document.getElementById('metric-nurses-active').innerText = metrics.nurses.active;
        document.getElementById('metric-patients').innerText = metrics.patients.total;
        document.getElementById('metric-bookings-active').innerText = metrics.bookings.active;
        document.getElementById('metric-revenue').innerText = `$${metrics.revenue.toFixed(2)}`;

        document.getElementById('health-match-time').innerText = `${health.averageMatchTimeMinutes || '--'} mins`;
        document.getElementById('health-payment-success').innerText = health.payments.successRate;
        document.getElementById('health-payment-failed').innerText = health.payments.failed;

        document.getElementById('action-pending-nurses').innerText = metrics.nurses.pending;
        document.getElementById('action-emergencies').innerText = metrics.emergencies;
        document.getElementById('action-disputes').innerText = metrics.disputes;

        // Emergency Badge
        const badge = document.getElementById('nav-emergency-badge');
        if (metrics.emergencies > 0) {
            badge.innerText = metrics.emergencies;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

    } catch (err) {
        if (!silent) console.error("Failed to load overview", err);
    }
}

// 2. Verifications Loading
async function loadVerifications() {
    try {
        const nurses = await api.getPendingVerifications();
        const tbody = document.getElementById('verifications-tbody');
        tbody.innerHTML = '';

        nurses.forEach(nurse => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${nurse.idPhotoUrl || 'https://via.placeholder.com/40'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                        <strong>${nurse.fullName}</strong>
                    </div>
                </td>
                <td>
                    <div style="font-size:0.85rem">${nurse.email}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted)">${nurse.phone}</div>
                </td>
                <td>${nurse.licenseNumber || 'N/A'}</td>
                <td><span class="status-badge status-pending">${nurse.status}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-sm approve" onclick="verifyNurse('${nurse._id}')"><i class="fa-solid fa-check"></i> Verify</button>
                        <button class="btn-sm reject" onclick="rejectNurse('${nurse._id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

window.verifyNurse = async (id) => {
    if(confirm('Approve this nurse application?')) {
        await api.updateVerificationStatus(id, 'Active', 'Approved manually');
        loadVerifications();
        loadOverview(true);
    }
}
window.rejectNurse = async (id) => {
    if(confirm('Reject this application?')) {
        await api.updateVerificationStatus(id, 'Suspended', 'Rejected manually');
        loadVerifications();
    }
}

// 3. Bookings Loading
async function loadBookings() {
    try {
        const bookings = await api.getAllBookings();
        const tbody = document.getElementById('bookings-tbody');
        tbody.innerHTML = '';

        bookings.forEach(b => {
            const statusClass = b.status === 'Completed' ? 'status-verified' : 
                              (b.status === 'Cancelled' ? 'status-danger' : 'status-pending');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span style="font-family:monospace; font-size:0.8rem">${b._id.slice(-6)}</span></td>
                <td>${b.patientId?.fullName || 'Unknown'}</td>
                <td>${b.nurseId?.fullName || 'Unknown'}</td>
                <td>$${b.totalAmount}</td>
                <td><span class="status-badge ${statusClass}">${b.status}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-sm info">Details</button>
                        ${b.status !== 'Cancelled' ? `<button class="btn-sm reject" onclick="cancelBooking('${b._id}')">Cancel</button>` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

// 4. Incidents & Emergencies
async function loadIncidents() {
    try {
        const incidents = await api.getIncidents();
        const tbody = document.getElementById('incidents-tbody');
        tbody.innerHTML = '';

        incidents.forEach(i => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${i.type}</strong></td>
                <td><div style="max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${i.description}</div></td>
                <td><span class="status-badge ${i.status === 'Open' ? 'status-danger' : 'status-pending'}">${i.status}</span></td>
                <td><button class="btn-sm info">View</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch(err) { console.error(err); }
}

async function loadEmergencies() {
    try {
        const emergencies = await api.getEmergencies();
        const tbody = document.getElementById('emergencies-tbody');
        tbody.innerHTML = '';

        emergencies.forEach(e => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(e.createdAt).toLocaleString()}</td>
                <td>${e.patientId?.fullName || 'Unknown'}</td>
                <td><code>[${e.location.coordinates.join(', ')}]</code></td>
                <td><span class="status-badge status-danger">${e.status}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-sm approve" onclick="escalateEmergency('${e._id}')">Escalate to 911</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(err) { console.error(err); }
}

window.escalateEmergency = async (id) => {
    if(confirm('Dispatch emergency services to these coordinates?')) {
        await api.escalateEmergency(id, 'Ambulance Dispatched');
        loadEmergencies();
        loadOverview(true);
    }
}
