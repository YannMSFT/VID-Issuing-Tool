const express = require('express');
const authModule = require('./auth');
const NodeCache = require('node-cache');

const router = express.Router();
const cache = new NodeCache();

// Route to get global statistics
router.get('/stats', authModule.requireAuth, (req, res) => {
    try {
        const allKeys = cache.keys();
        const allRequests = allKeys.map(key => cache.get(key)).filter(Boolean);
        
        const stats = {
            totalRequests: allRequests.length,
            completedRequests: allRequests.filter(r => r.status === 'completed').length,
            pendingRequests: allRequests.filter(r => r.status === 'pending').length,
            errorRequests: allRequests.filter(r => r.status === 'error').length,
            recentActivity: allRequests
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 10)
                .map(r => ({
                    requestId: r.requestId,
                    credentialType: r.credentialType,
                    userId: r.userId,
                    status: r.status,
                    createdAt: r.createdAt,
                    completedAt: r.completedAt
                }))
        };

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error retrieving statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Error retrieving statistics'
        });
    }
});

// Route to get detailed logs
router.get('/logs', authModule.requireAuth, (req, res) => {
    try {
        const { limit = 50, status, credentialType } = req.query;
        const allKeys = cache.keys();
        let allRequests = allKeys.map(key => cache.get(key)).filter(Boolean);
        
        // Filtrage
        if (status) {
            allRequests = allRequests.filter(r => r.status === status);
        }
        if (credentialType) {
            allRequests = allRequests.filter(r => r.credentialType === credentialType);
        }
        
        // Sort by creation date (most recent first)
        allRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Limitation
        allRequests = allRequests.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            logs: allRequests.map(r => ({
                requestId: r.requestId,
                credentialType: r.credentialType,
                userId: r.userId,
                userEmail: r.userEmail,
                status: r.status,
                createdAt: r.createdAt,
                completedAt: r.completedAt,
                callbackData: r.callbackData,
                issuanceResponse: process.env.NODE_ENV === 'development' ? r.issuanceResponse : undefined
            }))
        });
    } catch (error) {
        console.error('Error retrieving logs:', error);
        res.status(500).json({
            success: false,
            error: 'Error retrieving logs'
        });
    }
});

// Route to clean cache (remove old entries)
router.post('/cleanup', authModule.requireAuth, (req, res) => {
    try {
        const { olderThanHours = 24 } = req.body;
        const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
        
        const allKeys = cache.keys();
        let deletedCount = 0;
        
        allKeys.forEach(key => {
            const request = cache.get(key);
            if (request && new Date(request.createdAt) < cutoffTime) {
                cache.del(key);
                deletedCount++;
            }
        });
        
        res.json({
            success: true,
            message: `${deletedCount} entries deleted`,
            deletedCount
        });
    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({
            success: false,
            error: 'Error during cache cleanup'
        });
    }
});

// Route to test configuration
router.get('/test-config', authModule.requireAuth, (req, res) => {
    const config = {
        tenantId: process.env.TENANT_ID ? '✓ Configured' : '✗ Missing',
        clientId: process.env.CLIENT_ID ? '✓ Configured' : '✗ Missing',
        clientSecret: process.env.CLIENT_SECRET ? '✓ Configured' : '✗ Missing',
        issuerAuthority: process.env.ISSUER_AUTHORITY ? '✓ Configured' : '✗ Missing',
        verifiableCredentialsEndpoint: process.env.VERIFIABLE_CREDENTIALS_ENDPOINT ? '✓ Configured' : '✗ Missing',
        requestServiceUrl: process.env.REQUEST_SERVICE_URL ? '✓ Configured' : '✗ Missing'
    };
    
    const allConfigured = Object.values(config).every(status => status.includes('✓'));
    
    res.json({
        success: true,
        configuration: config,
        status: allConfigured ? 'Configuration complete' : 'Incomplete configuration',
        allConfigured
    });
});

// Route to get troubleshooting information
router.get('/troubleshoot', authModule.requireAuth, (req, res) => {
    try {
        const allKeys = cache.keys();
        const allRequests = allKeys.map(key => cache.get(key)).filter(Boolean);
        const errorRequests = allRequests.filter(r => r.status === 'error');
        
        const troubleshootInfo = {
            cacheStatus: {
                totalEntries: allRequests.length,
                errorEntries: errorRequests.length,
                cacheKeys: allKeys.slice(0, 10) // First 10 to avoid spam
            },
            recentErrors: errorRequests
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5)
                .map(r => ({
                    requestId: r.requestId,
                    credentialType: r.credentialType,
                    createdAt: r.createdAt,
                    callbackData: r.callbackData,
                    error: r.issuanceResponse?.error || 'Unknown error'
                })),
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage()
            }
        };
        
        res.json({
            success: true,
            troubleshoot: troubleshootInfo
        });
    } catch (error) {
        console.error('Error during troubleshooting:', error);
        res.status(500).json({
            success: false,
            error: 'Error retrieving troubleshooting information'
        });
    }
});

module.exports = router;
