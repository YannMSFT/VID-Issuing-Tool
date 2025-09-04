const express = require('express');
const axios = require('axios');
const authModule = require('./auth');

const router = express.Router();

// Function to get Graph API token
async function getGraphToken() {
    try {
        if (!process.env.CLIENT_ID || process.env.CLIENT_ID === 'your-client-id-here') {
            throw new Error('Missing configuration - CLIENT_ID not configured');
        }
        
        const response = await axios.post(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials'
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting Graph token:', error);
        throw new Error('Unable to get Graph API token');
    }
}

// Route to list tenant users
router.get('/list', authModule.requireAuth, async (req, res) => {
    try {
        const { search, top = 20, skip = 0 } = req.query;
        
        console.log('🔍 User list request debug:');
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log('CLIENT_ID:', process.env.CLIENT_ID);
        
        const accessToken = await getGraphToken();
        
        // Build basic filter that is compatible with Microsoft Graph
        const baseFilters = [
            "userType eq 'Member'", // Only regular members, not guests
            "accountEnabled eq true" // Only active accounts
            // Note: Removed 'mail ne null' as it's not supported by Graph API
            // We'll filter for users with mail addresses client-side instead
        ];
        
        let url = `https://graph.microsoft.com/v1.0/users?$top=${top}&$select=id,displayName,userPrincipalName,mail,jobTitle,department,userType,accountEnabled`;
        
        // Add search filter if provided
        if (search) {
            const searchFilter = `(startswith(displayName,'${search}') or startswith(userPrincipalName,'${search}') or startswith(mail,'${search}'))`;
            const combinedFilter = `(${baseFilters.join(' and ')}) and ${searchFilter}`;
            url += `&$filter=${encodeURIComponent(combinedFilter)}`;
        } else {
            url += `&$filter=${encodeURIComponent(baseFilters.join(' and '))}`;
        }

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Enhanced client-side filtering to exclude service accounts and conference rooms
        const filteredUsers = response.data.value.filter(user => {
            const displayName = (user.displayName || '').toLowerCase();
            const upn = (user.userPrincipalName || '').toLowerCase();
            
            // Skip conference rooms
            const isConferenceRoom = displayName.includes('room') || 
                                   displayName.includes('conf') || 
                                   displayName.includes('meeting') ||
                                   displayName.includes('salle') ||
                                   displayName.includes('conference');
                                   
            // Skip service accounts
            const isServiceAccount = upn.startsWith('svc-') || 
                                   upn.startsWith('service') || 
                                   upn.startsWith('admin') ||
                                   upn.includes('noreply') ||
                                   upn.includes('no-reply') ||
                                   displayName.includes('service') ||
                                   displayName.includes('system') ||
                                   displayName.includes('sync') ||
                                   displayName.includes('admin') ||
                                   displayName.includes('test') ||
                                   displayName.includes('mailbox');
            
            // Only include users with valid attributes
            const hasValidAttributes = user.mail && // Must have email address
                                     user.userType === 'Member' && 
                                     user.accountEnabled &&
                                     user.displayName &&
                                     !displayName.startsWith('__');
            
            return !isConferenceRoom && !isServiceAccount && hasValidAttributes;
        });

        res.json({
            success: true,
            users: filteredUsers.map(user => ({
                id: user.id,
                displayName: user.displayName,
                email: user.mail || user.userPrincipalName,
                userPrincipalName: user.userPrincipalName,
                jobTitle: user.jobTitle,
                department: user.department,
                userType: user.userType
            })),
            totalCount: filteredUsers.length,
            message: filteredUsers.length !== response.data.value.length ? 
                     `Filtered out ${response.data.value.length - filteredUsers.length} service accounts/conference rooms` : null
        });
    } catch (error) {
        console.error('Error retrieving users:', error.response?.data || error);
        console.error('Full error details:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            message: error.message,
            data: error.response?.data
        });
        
        // Check if it's a permissions error and return proper error
        const errorMessage = error.response?.data?.error?.message || error.message || '';
        const isPermissionError = error.response?.status === 400 || error.response?.status === 403;
        
        if (isPermissionError) {
            console.log('❌ Graph API permissions issue detected');
            console.log('Please ensure the following permissions are granted with admin consent:');
            console.log('- User.Read.All (Application)');
            console.log('- Directory.Read.All (Application)');
            
            return res.status(403).json({
                success: false,
                error: 'Microsoft Graph API permissions required',
                message: 'Please grant admin consent for User.Read.All and Directory.Read.All permissions in your App Registration.',
                permissionsHelp: {
                    required: ['User.Read.All (Application)', 'Directory.Read.All (Application)'],
                    grantConsentUrl: `https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/${process.env.CLIENT_ID}/isMSAApp~/false`
                }
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Error retrieving users',
            details: error.response?.data || error.message,
            troubleshooting: {
                possibleCauses: [
                    'Missing Microsoft Graph permissions',
                    'Admin consent not granted',
                    'Invalid tenant/client configuration'
                ],
                nextSteps: [
                    'Check App Registration permissions in Azure portal',
                    'Grant admin consent for User.Read.All and Directory.Read.All',
                    'Verify TENANT_ID and CLIENT_ID in .env file'
                ]
            }
        });
    }
});

// Route to get specific user details
router.get('/:userId', authModule.requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const accessToken = await getGraphToken();
        
        const response = await axios.get(`https://graph.microsoft.com/v1.0/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const user = response.data;
        res.json({
            success: true,
            user: {
                id: user.id,
                displayName: user.displayName,
                email: user.mail || user.userPrincipalName,
                userPrincipalName: user.userPrincipalName,
                jobTitle: user.jobTitle,
                department: user.department,
                officeLocation: user.officeLocation,
                mobilePhone: user.mobilePhone,
                businessPhones: user.businessPhones,
                createdDateTime: user.createdDateTime,
                userType: user.userType
            }
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération de l\'utilisateur',
            details: error.response?.data || error.message
        });
    }
});

// Route to search users with advanced filters
router.post('/search', authModule.requireAuth, async (req, res) => {
    try {
        const { filters, top = 20, skip = 0 } = req.body;
        const accessToken = await getGraphToken();
        
        // Basic filters compatible with Microsoft Graph
        const baseFilters = [
            "userType eq 'Member'",
            "accountEnabled eq true",
            "mail ne null"
        ];
        
        let filterQuery = '';
        if (filters) {
            const searchFilters = [];
            if (filters.displayName) {
                searchFilters.push(`startswith(displayName,'${filters.displayName}')`);
            }
            if (filters.department) {
                searchFilters.push(`department eq '${filters.department}'`);
            }
            if (filters.jobTitle) {
                searchFilters.push(`startswith(jobTitle,'${filters.jobTitle}')`);
            }
            
            // Combine base filters with search filters
            const allFilters = [...baseFilters];
            if (searchFilters.length > 0) {
                allFilters.push(...searchFilters);
            }
            filterQuery = `&$filter=${encodeURIComponent(allFilters.join(' and '))}`;
        } else {
            filterQuery = `&$filter=${encodeURIComponent(baseFilters.join(' and '))}`;
        }
        
        const url = `https://graph.microsoft.com/v1.0/users?$top=${top}&$skip=${skip}&$select=id,displayName,userPrincipalName,mail,jobTitle,department,userType,accountEnabled${filterQuery}`;
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Enhanced client-side filtering for search results
        const filteredUsers = response.data.value.filter(user => {
            const displayName = (user.displayName || '').toLowerCase();
            const upn = (user.userPrincipalName || '').toLowerCase();
            
            const isConferenceRoom = displayName.includes('room') || 
                                   displayName.includes('conf') || 
                                   displayName.includes('meeting') ||
                                   displayName.includes('salle') ||
                                   displayName.includes('conference');
                                   
            const isServiceAccount = upn.startsWith('svc-') || 
                                   upn.startsWith('service') || 
                                   upn.startsWith('admin') ||
                                   upn.includes('noreply') ||
                                   upn.includes('no-reply') ||
                                   displayName.includes('service') ||
                                   displayName.includes('system') ||
                                   displayName.includes('sync') ||
                                   displayName.includes('admin') ||
                                   displayName.includes('test') ||
                                   displayName.includes('mailbox');
            
            const hasValidAttributes = user.mail && 
                                     user.userType === 'Member' && 
                                     user.accountEnabled &&
                                     user.displayName &&
                                     !displayName.startsWith('__');
            
            return !isConferenceRoom && !isServiceAccount && hasValidAttributes;
        });

        res.json({
            success: true,
            users: filteredUsers.map(user => ({
                id: user.id,
                displayName: user.displayName,
                email: user.mail || user.userPrincipalName,
                userPrincipalName: user.userPrincipalName,
                jobTitle: user.jobTitle,
                department: user.department,
                userType: user.userType
            })),
            totalCount: filteredUsers.length,
            message: filteredUsers.length !== response.data.value.length ? 
                     `Filtered out ${response.data.value.length - filteredUsers.length} service accounts/conference rooms` : null
        });
    } catch (error) {
        console.error('Erreur lors de la recherche des utilisateurs:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la recherche des utilisateurs',
            details: error.response?.data || error.message
        });
    }
});

module.exports = router;
