// Global variables
let selectedUser = null;
let selectedCredential = null;
let currentRequest = null;

// Application initialization
document.addEventListener('DOMContentLoaded', function() {
    // Check for URL parameters (success/error messages)
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('success') === 'authenticated') {
        showNotification('Successfully authenticated with Microsoft!', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
        // Force check authentication status after successful auth
        setTimeout(() => {
            checkAuthStatus();
        }, 1000);
    }
    
    if (urlParams.get('error')) {
        const error = urlParams.get('error');
        const details = urlParams.get('details');
        let message = 'Authentication failed';
        
        if (error === 'auth_failed') message = 'Microsoft authentication failed';
        if (error === 'no_auth_code') message = 'No authorization code received';
        if (error === 'token_acquisition_failed') message = 'Failed to acquire access token';
        if (error === 'msal_not_configured') message = 'Authentication service not configured';
        if (details) message += ': ' + decodeURIComponent(details);
        
        showNotification(message, 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (urlParams.get('logged_out') === 'true') {
        showNotification('Successfully logged out', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    checkAuthStatus();
    
    // Handle issue form
    document.getElementById('issue-form').addEventListener('submit', handleIssueSubmit);
    
    // Handle user search
    document.getElementById('user-search').addEventListener('input', debounce(searchUsers, 300));
    
    // Handle logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            // Check if in demo mode
            if (sessionStorage.getItem('demoMode') === 'true') {
                // Exit demo mode
                sessionStorage.removeItem('demoMode');
                sessionStorage.removeItem('demoUser');
                document.getElementById('login-section').style.display = 'block';
                document.getElementById('main-interface').style.display = 'none';
                showNotification('Exited demo mode', 'success');
                return;
            }
            
            // Normal logout process
            logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing out...';
            logoutBtn.classList.add('disabled');
            showNotification('Signing out...', 'info');
        });
    }
});

// Handle Microsoft login
async function startMicrosoftLogin() {
    const loginBtn = document.getElementById('microsoft-login-btn');
    const originalText = loginBtn.innerHTML;
    
    try {
        // Show loading state
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        loginBtn.disabled = true;
        
        console.log('🔐 Starting Microsoft login...');
        
        // Fetch the authentication URL from the server
        const response = await fetch('/auth/login', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Authentication request failed');
        }
        
        const data = await response.json();
        console.log('✅ Received auth URL, redirecting...');
        
        // Redirect to Microsoft login page
        window.location.href = data.authUrl;
        
    } catch (error) {
        console.error('💥 Login error:', error);
        showNotification(`Login failed: ${error.message}`, 'error');
        
        // Restore button
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

// Enable demo mode for testing
function enableDemoMode() {
    console.log('🎭 Enabling demo mode...');
    
    // Simulate authenticated user
    const demoUser = {
        authenticated: true,
        name: 'Demo User',
        email: 'demo@example.com',
        id: 'demo-user-id',
        roles: ['VID.Admin']
    };
    
    // Store in session storage
    sessionStorage.setItem('demoMode', 'true');
    sessionStorage.setItem('demoUser', JSON.stringify(demoUser));
    
    // Update UI
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('main-interface').style.display = 'block';
    
    // Update user info
    updateUserInterface(demoUser);
    
    // Load initial data
    loadCredentials();
    
    console.log('✅ Demo mode enabled successfully');
}

// Check authentication status
async function checkAuthStatus() {
    console.log('🔍 Checking authentication status...');
    
    // Check for demo mode first
    if (sessionStorage.getItem('demoMode') === 'true') {
        console.log('🎭 Demo mode detected');
        const demoUser = JSON.parse(sessionStorage.getItem('demoUser'));
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('main-interface').style.display = 'block';
        updateUserInterface(demoUser);
        loadCredentials();
        return;
    }
    
    try {
        const response = await fetch('/auth/status', {
            method: 'GET',
            credentials: 'include', // Important for session cookies
            headers: {
                'Accept': 'application/json'
            }
        });
        console.log('📡 Response status:', response.status);
        const data = await response.json();
        console.log('📋 Auth data:', data);
        
        if (data.authenticated) {
            console.log('✅ User is authenticated');
            document.getElementById('user-info').textContent = `Signed in as ${data.user.name}`;
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('main-interface').style.display = 'block';
            
            // Load initial data
            loadCredentials();
            loadUsers();
            loadTroubleshootInfo();
        } else {
            console.log('❌ User is not authenticated, showing login');
            document.getElementById('login-section').style.display = 'block';
            document.getElementById('main-interface').style.display = 'none';
        }
    } catch (error) {
        console.error('💥 Error checking authentication:', error);
        showNotification('Connection error', 'error');
        // Show login section on error
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('main-interface').style.display = 'none';
    }
}

// Update user interface with user info
function updateUserInterface(user) {
    document.getElementById('user-info').textContent = `Signed in as ${user.name}`;
    if (sessionStorage.getItem('demoMode') === 'true') {
        document.getElementById('user-info').textContent += ' (Demo Mode)';
    }
}

// Load available credentials
async function loadCredentials() {
    console.log('🔍 Loading credentials...');
    try {
        const response = await fetch('/api/credentials/list');
        console.log('📡 Response status:', response.status);
        const data = await response.json();
        console.log('📋 Received data:', data);
        
        const container = document.getElementById('credentials-list');
        
        if (data.success && data.credentials.length > 0) {
            container.innerHTML = data.credentials.map(credential => `
                <div class="credential-item" onclick="selectCredential('${credential.id}', '${credential.displayName || credential.name}')">
                    <strong>${credential.displayName || credential.name}</strong>
                    <small class="d-block text-muted">${credential.id}</small>
                    <div class="small text-muted">${credential.description || ''}</div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    No credentials configured. Check your Entra ID configuration.
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading credentials:', error);
        document.getElementById('credentials-list').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-times-circle"></i>
                Error loading credentials
            </div>
        `;
    }
}

// Select a credential
function selectCredential(id, title) {
    selectedCredential = { id, title };
    document.getElementById('selected-credential').value = title;
    
    // Update interface
    document.querySelectorAll('.credential-item').forEach(item => item.classList.remove('selected'));
    event.target.closest('.credential-item').classList.add('selected');
    
    updateIssueButton();
}

// Load users
async function loadUsers(search = '') {
    try {
        const url = search ? `/api/users/list?search=${encodeURIComponent(search)}` : '/api/users/list';
        const response = await fetch(url);
        const data = await response.json();
        
        const container = document.getElementById('users-list');
        
        if (data.success && data.users.length > 0) {
            container.innerHTML = data.users.map(user => `
                <div class="user-item" onclick="selectUser('${user.id}', '${user.displayName}', '${user.email}')">
                    <strong>${user.displayName}</strong>
                    <small class="d-block text-muted">${user.email}</small>
                    ${user.jobTitle ? `<small class="d-block text-muted">${user.jobTitle}</small>` : ''}
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    ${search ? 'Aucun utilisateur trouvé pour cette recherche' : 'Chargement des utilisateurs...'}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('users-list').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-times-circle"></i>
                Error loading users
            </div>
        `;
    }
}

// Sélection d'un utilisateur
function selectUser(id, displayName, email) {
    selectedUser = { id, displayName, email };
    document.getElementById('selected-user').value = `${displayName} (${email})`;
    
    // Mise à jour de l'interface
    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('selected'));
    event.target.closest('.user-item').classList.add('selected');
    
    updateIssueButton();
}

// Recherche d'utilisateurs avec debounce
function searchUsers() {
    const search = document.getElementById('user-search').value;
    loadUsers(search);
}

// Update issue button
function updateIssueButton() {
    const issueBtn = document.getElementById('issue-btn');
    issueBtn.disabled = !selectedUser || !selectedCredential;
}

// Handle credential issuance
async function handleIssueSubmit(event) {
    event.preventDefault();
    
    if (!selectedUser || !selectedCredential) {
        showNotification('Veuillez sélectionner un utilisateur et un credential', 'error');
        return;
    }
    
    const issueBtn = document.getElementById('issue-btn');
    const originalText = issueBtn.innerHTML;
    issueBtn.disabled = true;
    issueBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Issuing credential...';

    try {
        let additionalClaims = {};
        const claimsText = document.getElementById('additional-claims').value.trim();
        if (claimsText) {
            try {
                additionalClaims = JSON.parse(claimsText);
            } catch (e) {
                showNotification('Format JSON invalide pour les claims supplémentaires', 'error');
                return;
            }
        }
        
        const response = await fetch('/api/credentials/issue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                credentialType: selectedCredential.id,
                userId: selectedUser.id,
                userEmail: selectedUser.email,
                claims: additionalClaims
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentRequest = data.requestId;
            showQRCode(data.qrCodeUrl, data.deepLink, data.pin);
            showNotification('Credential issued successfully!', 'success');
        } else {
            showNotification(`Issuance error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Credential issuance error:', error);
        showNotification('Error issuing credential', 'error');
    } finally {
        issueBtn.disabled = false;
        issueBtn.innerHTML = originalText;
    }
}

// Affichage du QR Code
function showQRCode(qrCodeUrl, deepLink, pin) {
    const qrSection = document.getElementById('qr-section');
    const qrContainer = document.getElementById('qr-code-container');
    const deepLinkContainer = document.getElementById('deep-link-container');
    
    qrContainer.innerHTML = `<img src="${qrCodeUrl}" alt="QR Code" class="img-fluid">`;
    
    let pinDisplay = '';
    if (pin && pin !== 'DEMO') {
        pinDisplay = `
            <div class="alert alert-info mt-3" style="background: #e3f2fd; border: 1px solid #2196f3; color: #1976d2;">
                <h5><i class="fas fa-key"></i> PIN Code Required</h5>
                <p class="mb-2">After scanning the QR code, enter this PIN code in Microsoft Authenticator:</p>
                <div class="text-center">
                    <span class="badge badge-primary" style="font-size: 1.5rem; padding: 10px 20px; background: #2196f3;">${pin}</span>
                </div>
            </div>
        `;
    } else if (pin === 'DEMO') {
        pinDisplay = `
            <div class="alert alert-warning mt-3">
                <i class="fas fa-info-circle"></i> Demo mode - No PIN required
            </div>
        `;
    }
    
    deepLinkContainer.innerHTML = `
        <a href="${deepLink}" class="btn btn-outline-primary btn-sm" target="_blank">
            <i class="fab fa-microsoft"></i> Open in Authenticator
        </a>
        ${pinDisplay}
    `;
    
    qrSection.style.display = 'block';
    qrSection.scrollIntoView({ behavior: 'smooth' });
}

// Chargement des statistiques
async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        
        if (data.success) {
            displayStats(data.stats);
            displayRecentActivity(data.stats.recentActivity);
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Affichage des statistiques
function displayStats(stats) {
    const container = document.getElementById('stats-container');
    container.innerHTML = `
        <div class="col-md-3">
            <div class="stats-card">
                <div class="stats-number">${stats.totalRequests}</div>
                <div>Total</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card" style="background: linear-gradient(45deg, #56ab2f 0%, #a8e6cf 100%);">
                <div class="stats-number">${stats.completedRequests}</div>
                <div>Complétés</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card" style="background: linear-gradient(45deg, #f7971e 0%, #ffd200 100%);">
                <div class="stats-number">${stats.pendingRequests}</div>
                <div>En attente</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stats-card" style="background: linear-gradient(45deg, #fc4a1a 0%, #f7b733 100%);">
                <div class="stats-number">${stats.errorRequests}</div>
                <div>Errors</div>
            </div>
        </div>
    `;
}

// Affichage de l'activité récente
function displayRecentActivity(activities) {
    const container = document.getElementById('recent-activity');
    
    if (!activities || activities.length === 0) {
        container.innerHTML = '<div class="alert alert-info">Aucune activité récente</div>';
        return;
    }
    
    container.innerHTML = activities.map(activity => `
        <div class="activity-item ${activity.status}">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${activity.credentialType}</strong>
                    <small class="d-block text-muted">Utilisateur: ${activity.userId}</small>
                </div>
                <div class="text-end">
                    <span class="badge bg-${getStatusColor(activity.status)}">${getStatusText(activity.status)}</span>
                    <small class="d-block text-muted">${formatDate(activity.createdAt)}</small>
                </div>
            </div>
        </div>
    `).join('');
}

// Chargement des informations de troubleshooting
async function loadTroubleshootInfo() {
    try {
        const response = await fetch('/api/admin/troubleshoot');
        const data = await response.json();
        
        if (data.success) {
            displaySystemInfo(data.troubleshoot.environment);
            displayRecentErrors(data.troubleshoot.recentErrors);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des informations de troubleshooting:', error);
    }
}

// Configuration test
async function testConfiguration() {
    try {
        const response = await fetch('/api/admin/test-config');
        const data = await response.json();
        
        const container = document.getElementById('config-test-results');
        
        if (data.success) {
            container.innerHTML = `
                <div class="alert alert-${data.allConfigured ? 'success' : 'warning'}">
                    <strong>${data.status}</strong>
                </div>
                ${Object.entries(data.configuration).map(([key, status]) => `
                    <div class="config-status ${status.includes('✓') ? 'ok' : 'error'}">
                        ${key}: ${status}
                    </div>
                `).join('')}
            `;
        }
    } catch (error) {
        console.error('Error during configuration test:', error);
        showNotification('Error during configuration test', 'error');
    }
}

// Nettoyage du cache
async function cleanupCache() {
    try {
        const response = await fetch('/api/admin/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ olderThanHours: 24 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`${data.deletedCount} entrées supprimées`, 'success');
            loadStats(); // Recharger les stats
        }
    } catch (error) {
        console.error('Erreur lors du nettoyage:', error);
        showNotification('Erreur lors du nettoyage du cache', 'error');
    }
}

// Affichage des erreurs récentes
function displayRecentErrors(errors) {
    const container = document.getElementById('recent-errors');
    
    if (!errors || errors.length === 0) {
        container.innerHTML = '<div class="alert alert-success">Aucune erreur récente</div>';
        return;
    }
    
    container.innerHTML = errors.map(error => `
        <div class="error-item">
            <strong>Request ID:</strong> ${error.requestId}<br>
            <strong>Type:</strong> ${error.credentialType}<br>
            <strong>Date:</strong> ${formatDate(error.createdAt)}<br>
            <strong>Erreur:</strong> ${error.error}
        </div>
    `).join('');
}

// Affichage des informations système
function displaySystemInfo(env) {
    const container = document.getElementById('system-info');
    container.innerHTML = `
        <div class="system-info-item">
            <span>Version Node.js:</span>
            <span>${env.nodeVersion}</span>
        </div>
        <div class="system-info-item">
            <span>Plateforme:</span>
            <span>${env.platform}</span>
        </div>
        <div class="system-info-item">
            <span>Uptime:</span>
            <span>${Math.floor(env.uptime / 3600)}h ${Math.floor((env.uptime % 3600) / 60)}m</span>
        </div>
        <div class="system-info-item">
            <span>Mémoire utilisée:</span>
            <span>${Math.round(env.memoryUsage.heapUsed / 1024 / 1024)} MB</span>
        </div>
    `;
}

// Utility functions
function getStatusColor(status) {
    const colors = {
        'completed': 'success',
        'pending': 'warning',
        'error': 'danger'
    };
    return colors[status] || 'secondary';
}

function getStatusText(status) {
    const texts = {
        'completed': 'Complété',
        'pending': 'En attente',
        'error': 'Erreur'
    };
    return texts[status] || status;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString('fr-FR');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showNotification(message, type = 'info') {
    const toast = document.getElementById('notification-toast');
    const toastBody = toast.querySelector('.toast-body');
    
    toastBody.textContent = message;
    
    // Changer la couleur selon le type
    toast.className = `toast bg-${type === 'error' ? 'danger' : type} text-white`;
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}
