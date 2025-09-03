const express = require('express');
const axios = require('axios');
const authModule = require('./auth');

const router = express.Router();

// Function to get Graph API token
async function getGraphToken() {
    try {
        if (!process.env.CLIENT_ID || process.env.CLIENT_ID === 'your-client-id-here') {
            throw new Error('Missing configuration - demo mode');
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
        
        if (process.env.NODE_ENV === 'development' && (!process.env.CLIENT_ID || process.env.CLIENT_ID === 'your-client-id-here')) {
            // Demo mode
            const demoUsers = [
                {
                    id: '1',
                    displayName: 'Alice Martin',
                    email: 'alice.martin@demo.com',
                    userPrincipalName: 'alice.martin@demo.com',
                    jobTitle: 'Manager',
                    department: 'IT',
                    userType: 'Member'
                },
                {
                    id: '2',
                    displayName: 'Bob Dupont',
                    email: 'bob.dupont@demo.com',
                    userPrincipalName: 'bob.dupont@demo.com',
                    jobTitle: 'Developer',
                    department: 'Engineering',
                    userType: 'Member'
                },
                {
                    id: '3',
                    displayName: 'Claire Moreau',
                    email: 'claire.moreau@demo.com',
                    userPrincipalName: 'claire.moreau@demo.com',
                    jobTitle: 'Student',
                    department: 'Education',
                    userType: 'Member'
                }
            ];
            
            let filteredUsers = demoUsers;
            if (search) {
                filteredUsers = demoUsers.filter(user => 
                    user.displayName.toLowerCase().includes(search.toLowerCase()) ||
                    user.email.toLowerCase().includes(search.toLowerCase())
                );
            }
            
            res.json({
                success: true,
                users: filteredUsers,
                totalCount: filteredUsers.length
            });
            return;
        }
        
        const accessToken = await getGraphToken();
        
        // Build filter to exclude service accounts and conference rooms
        const baseFilters = [
            "userType eq 'Member'", // Only regular members, not guests
            "accountEnabled eq true", // Only active accounts
            "not startswith(displayName,'Room')", // Exclude conference rooms starting with "Room"
            "not startswith(displayName,'Conf')", // Exclude conference rooms starting with "Conf"
            "not startswith(displayName,'Conference')", // Exclude conference rooms starting with "Conference"
            "not endswith(displayName,'Room')", // Exclude accounts ending with "Room"
            "not startswith(userPrincipalName,'svc-')", // Exclude service accounts starting with svc-
            "not startswith(userPrincipalName,'service')", // Exclude service accounts starting with service
            "not startswith(userPrincipalName,'admin')", // Exclude admin service accounts
            "not contains(displayName,'Service')", // Exclude accounts containing "Service"
            "mail ne null" // Only users with email addresses
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

        // Additional client-side filtering as a backup
        const filteredUsers = response.data.value.filter(user => {
            const displayName = (user.displayName || '').toLowerCase();
            const upn = (user.userPrincipalName || '').toLowerCase();
            
            // Skip conference rooms and service accounts
            const isConferenceRoom = displayName.includes('room') || 
                                   displayName.includes('conf') || 
                                   displayName.includes('meeting') ||
                                   displayName.includes('salle');
                                   
            const isServiceAccount = upn.startsWith('svc-') || 
                                   upn.startsWith('service') || 
                                   upn.startsWith('admin') ||
                                   displayName.includes('service') ||
                                   displayName.includes('system') ||
                                   displayName.includes('sync');
            
            return !isConferenceRoom && !isServiceAccount && user.mail && user.userType === 'Member';
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
        console.error('Erreur lors de la récupération des utilisateurs:', error.response?.data || error);
        
        // Check if it's a permissions error and provide demo users
        const errorMessage = error.response?.data?.error?.message || error.message || '';
        const isPermissionError = error.response?.status === 400 || error.response?.status === 403;
        
        if (isPermissionError) {
            console.log('⚠️  Graph API permissions issue, providing demo users');
            const demoUsers = [
                {
                    id: 'demo-user-1',
                    displayName: 'John Doe',
                    email: 'john.doe@contoso.com',
                    userPrincipalName: 'john.doe@contoso.com',
                    jobTitle: 'Software Engineer',
                    department: 'Engineering'
                },
                {
                    id: 'demo-user-2',
                    displayName: 'Jane Smith',
                    email: 'jane.smith@contoso.com', 
                    userPrincipalName: 'jane.smith@contoso.com',
                    jobTitle: 'Project Manager',
                    department: 'Management'
                },
                {
                    id: 'demo-user-3',
                    displayName: 'Bob Johnson',
                    email: 'bob.johnson@contoso.com',
                    userPrincipalName: 'bob.johnson@contoso.com', 
                    jobTitle: 'Security Analyst',
                    department: 'Security'
                }
            ];
            
            return res.json({
                success: true,
                users: demoUsers,
                totalCount: demoUsers.length,
                message: '⚠️ Demo mode: Grant Microsoft Graph permissions to see real users',
                demoMode: true
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des utilisateurs',
            details: error.response?.data || error.message
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
        
        // Base filters to exclude service accounts and conference rooms
        const baseFilters = [
            "userType eq 'Member'",
            "accountEnabled eq true",
            "not startswith(displayName,'Room')",
            "not startswith(displayName,'Conf')",
            "not startswith(displayName,'Conference')",
            "not endswith(displayName,'Room')",
            "not startswith(userPrincipalName,'svc-')",
            "not startswith(userPrincipalName,'service')",
            "not startswith(userPrincipalName,'admin')",
            "not contains(displayName,'Service')",
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

        // Additional client-side filtering as a backup
        const filteredUsers = response.data.value.filter(user => {
            const displayName = (user.displayName || '').toLowerCase();
            const upn = (user.userPrincipalName || '').toLowerCase();
            
            const isConferenceRoom = displayName.includes('room') || 
                                   displayName.includes('conf') || 
                                   displayName.includes('meeting') ||
                                   displayName.includes('salle');
                                   
            const isServiceAccount = upn.startsWith('svc-') || 
                                   upn.startsWith('service') || 
                                   upn.startsWith('admin') ||
                                   displayName.includes('service') ||
                                   displayName.includes('system') ||
                                   displayName.includes('sync');
            
            return !isConferenceRoom && !isServiceAccount && user.mail && user.userType === 'Member';
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
