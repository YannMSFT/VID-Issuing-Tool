const express = require('express');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const router = express.Router();

// MSAL configuration with environment variables validation
const clientConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`
    }
};

let cca;
try {
    // Verify that required environment variables are present
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.TENANT_ID) {
        throw new Error('Missing required environment variables: CLIENT_ID, CLIENT_SECRET, or TENANT_ID');
    }
    cca = new ConfidentialClientApplication(clientConfig);
    console.log('✅ MSAL configuration successful');
} catch (error) {
    console.warn('❌ MSAL configuration error - authentication will not work:', error.message);
    cca = null;
}

// Middleware to verify authentication
const requireAuth = (req, res, next) => {
    // In production mode, authentication is required
    if (process.env.NODE_ENV === 'production' && !req.session.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    // In development mode, allow access without authentication if MSAL is not configured
    if (process.env.NODE_ENV === 'development' && !cca) {
        console.warn('⚠️  Development mode: Bypassing authentication (MSAL not configured)');
    }
    next();
};

// Login route
router.get('/login', (req, res) => {
    console.log('🔐 Login route accessed');
    if (!cca) {
        console.error('❌ MSAL not configured properly - cannot authenticate');
        return res.status(500).json({ 
            error: 'Authentication service not configured. Please check your environment variables.',
            details: 'CLIENT_ID, CLIENT_SECRET, and TENANT_ID must be properly set'
        });
    }
    
    console.log('✅ MSAL configured, generating auth URL...');
    const authCodeUrlParameters = {
        scopes: ['https://graph.microsoft.com/.default'],
        redirectUri: process.env.REDIRECT_URI,
    };

    cca.getAuthCodeUrl(authCodeUrlParameters).then((response) => {
        console.log('🔗 Generated auth URL:', response.substring(0, 100) + '...');
        
        // Check if request expects JSON (from JavaScript fetch)
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            // Return URL for JavaScript to handle the redirect
            res.json({ authUrl: response });
        } else {
            // Direct browser access - do server-side redirect
            res.redirect(response);
        }
    }).catch((error) => {
        console.error('💥 Error generating authentication URL:', error);
        res.status(500).json({ error: 'Authentication error', details: error.message });
    });
});

// Callback route after authentication
router.get('/callback', (req, res) => {
    console.log('🔄 Callback route accessed');
    console.log('📥 Query params:', Object.keys(req.query));
    
    if (!cca) {
        console.error('❌ MSAL not configured - cannot handle callback');
        return res.redirect('/?error=msal_not_configured');
    }
    
    if (req.query.error) {
        console.error('❌ Authentication error from Microsoft:', req.query.error, req.query.error_description);
        return res.redirect('/?error=auth_failed&details=' + encodeURIComponent(req.query.error_description || req.query.error));
    }
    
    if (!req.query.code) {
        console.error('❌ No authorization code received');
        return res.redirect('/?error=no_auth_code');
    }
    
    console.log('✅ Processing authorization code...');
    const tokenRequest = {
        code: req.query.code,
        scopes: ['https://graph.microsoft.com/.default'],
        redirectUri: process.env.REDIRECT_URI,
    };

    cca.acquireTokenByCode(tokenRequest).then((response) => {
        console.log('🎉 Token acquired successfully');
        console.log('👤 User:', response.account?.name || 'Unknown');
        
        req.session.user = {
            accessToken: response.accessToken,
            account: response.account,
            name: response.account?.name || 'Unknown User',
            email: response.account?.username || 'unknown@unknown.com',
            isAdmin: true // Adapt according to your role verification needs
        };
        
        console.log('✅ User session created, redirecting to home');
        res.redirect('/?success=authenticated');
    }).catch((error) => {
        console.error('💥 Error acquiring token:', error);
        res.redirect('/?error=token_acquisition_failed&details=' + encodeURIComponent(error.message));
    });
});

// Logout route
router.get('/logout', (req, res) => {
    // Save user information before destroying the session
    const hasRealUser = req.session?.user?.account?.homeAccountId;
    
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Error during logout:', err);
        }
        console.log('✅ User logged out successfully');
        
        // If MSAL is configured and we had a real user, perform a Microsoft logout
        if (cca && hasRealUser) {
            // Redirect to Microsoft logout URL
            const logoutUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(process.env.POST_LOGOUT_REDIRECT_URI || process.env.BASE_URL || 'http://localhost:3005')}`;
            res.redirect(logoutUrl);
        } else {
            // Simple redirect for demo mode
            res.redirect('/?logged_out=true');
        }
    });
});

// Route to check authentication status
router.get('/status', (req, res) => {
    console.log('📊 Status route accessed');
    if (req.session.user) {
        console.log('✅ User found in session');
        res.json({
            authenticated: true,
            user: {
                name: req.session.user.account?.name || 'Authenticated User',
                username: req.session.user.account?.username || 'user@company.com',
                isAdmin: req.session.user.isAdmin
            }
        });
    } else if (!cca) {
        // If MSAL is not configured, return error
        console.log('❌ MSAL not configured - authentication required');
        res.status(500).json({
            authenticated: false,
            error: 'Authentication system not configured',
            message: 'Please configure MSAL authentication with CLIENT_ID, CLIENT_SECRET, and TENANT_ID'
        });
    } else {
        console.log('❌ No user session found, requiring authentication');
        res.json({ authenticated: false });
    }
});

module.exports = router;

// Export middleware separately
module.exports.requireAuth = requireAuth;
