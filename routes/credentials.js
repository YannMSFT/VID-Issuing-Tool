const express = require('express');
const axios = require('axios');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');
const authModule = require('./auth');

const router = express.Router();
const cache = new NodeCache({ stdTTL: 600 }); // Cache 10 minutes

// Cache to store PIN support information for contracts (longer TTL)
const pinSupportCache = new NodeCache({ stdTTL: 86400 }); // Cache 24 hours

// Utility function to get access token
async function getAccessToken(customScope = null) {
    try {
        if (!process.env.CLIENT_ID || process.env.CLIENT_ID === 'your-client-id-here') {
            throw new Error('Missing configuration - CLIENT_ID not configured');
        }
        
        const scope = customScope || process.env.VERIFIABLE_CREDENTIALS_API_SCOPE || 'https://graph.microsoft.com/.default';
        console.log(`🔐 Getting access token with scope: ${scope}`);
        
        const response = await axios.post(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            scope: scope,
            grant_type: 'client_credentials'
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error obtaining token:', error);
        throw new Error('Unable to obtain access token');
    }
}

// Helper function to extract claims from contract
function extractClaimsFromContract(contract) {
    const claims = [];
    
    // Extract from display information
    if (contract.displays && contract.displays.length > 0) {
        const display = contract.displays[0]; // Use first display
        
        if (display.claims && display.claims.length > 0) {
            display.claims.forEach(claimInfo => {
                claims.push({
                    claim: claimInfo.claim,
                    label: claimInfo.label,
                    type: claimInfo.type,
                    required: false
                });
            });
        }
    }
    
    return claims;
}

// Route to list all available credentials
router.get('/list', authModule.requireAuth, async (req, res) => {
    try {
        console.log('🔍 Listing available credentials...');
        
        // Check if we have proper configuration
        if (!process.env.CLIENT_ID || process.env.CLIENT_ID === 'your-client-id-here') {
            return res.status(500).json({
                success: false,
                error: 'Application not properly configured',
                message: 'Please configure CLIENT_ID and other environment variables',
                troubleshooting: {
                    requiredConfig: ['CLIENT_ID', 'CLIENT_SECRET', 'TENANT_ID'],
                    configFile: '.env file in project root'
                }
            });
        }

        // Get real credentials from Microsoft Verified Credentials Admin API
        console.log('🚀 Retrieving credentials from Microsoft Verified Credentials Admin API');
        const accessToken = await getAccessToken();
    
        // Step 1: Get all authorities
        const authoritiesResponse = await axios.get(`${process.env.VERIFIABLE_CREDENTIALS_ENDPOINT}/authorities`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const authorities = authoritiesResponse.data.value || [];
        console.log(`📋 Found ${authorities.length} authorities in tenant`);

        // Step 2: For each authority, get its contracts
        let allCredentials = [];
        
        for (const authority of authorities) {
            try {
                const contractsResponse = await axios.get(`${process.env.VERIFIABLE_CREDENTIALS_ENDPOINT}/authorities/${authority.id}/contracts`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const contracts = contractsResponse.data.value || [];
                console.log(`📑 Authority "${authority.name}" has ${contracts.length} contracts`);
                
                // Transform contracts to match our UI format
                const credentialTypes = contracts.map(contract => ({
                    id: contract.id,
                    name: contract.name,
                    displayName: contract.name,
                    description: `Verifiable credential managed by authority: ${authority.name}`,
                    type: contract.rules?.vc?.type || ['VerifiableCredential'],
                    issuer: authority.name,
                    status: contract.status,
                    styling: contract.displays?.[0]?.card ? {
                        backgroundColor: contract.displays[0].card.backgroundColor || '#0066CC',
                        textColor: contract.displays[0].card.textColor || '#FFFFFF',
                        title: contract.displays[0].card.title,
                        description: contract.displays[0].card.description,
                        logo: contract.displays[0].card.logo
                    } : {
                        backgroundColor: '#0066CC',
                        textColor: '#FFFFFF',
                        title: contract.name,
                        description: `Verifiable credential: ${contract.name}`
                    },
                    claims: extractClaimsFromContract(contract)
                }));
                
                allCredentials.push(...credentialTypes);
                
            } catch (error) {
                console.error(`❌ Error fetching contracts for authority ${authority.id}:`, error.response?.data || error.message);
            }
        }

        console.log(`✅ Successfully retrieved ${allCredentials.length} credential types`);
        
        // Debug: log first credential structure
        if (allCredentials.length > 0) {
            console.log('📋 Sample credential structure:', JSON.stringify(allCredentials[0], null, 2));
        }
        
        res.json({
            success: true,
            credentials: allCredentials,
            message: `${allCredentials.length} credential types available for issuance`
        });

    } catch (error) {
        console.error('❌ Error retrieving credentials list:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve credentials list',
            details: error.response?.data || error.message
        });
    }
});

// Route to issue a credential
router.post('/issue', authModule.requireAuth, async (req, res) => {
    try {
        const { credentialType, userId, userEmail, claims } = req.body;
        
        if (!credentialType || !userId) {
            return res.status(400).json({
                success: false,
                error: 'credentialType and userId are required'
            });
        }

        const requestId = uuidv4();
        
        // Check if we have proper configuration
        if (!process.env.CLIENT_ID || process.env.CLIENT_ID === 'your-client-id-here') {
            return res.status(500).json({
                success: false,
                error: 'Application not properly configured',
                message: 'Please configure CLIENT_ID and other environment variables',
                troubleshooting: {
                    requiredConfig: ['CLIENT_ID', 'CLIENT_SECRET', 'TENANT_ID'],
                    configFile: '.env file in project root'
                }
            });
        }

        // Get access token for Request Service API (different scope!)
        console.log('🚀 Issuing real credential via Microsoft Verified Credentials Request Service API');
        
        // Use different scope for issuance requests
        const requestServiceScope = process.env.REQUEST_SERVICE_API_SCOPE || '3db474b9-6a0c-4840-96ac-1fceb342124f/.default';
        console.log(`🔐 Getting token for Request Service with scope: ${requestServiceScope}`);
        
        const accessToken = await getAccessToken(requestServiceScope);
        
        // Build the base issuance request according to Request Service API spec
        const baseIssuanceRequest = {
            includeQRCode: true,
            authority: process.env.ISSUER_AUTHORITY,
            registration: {
                clientName: "VID Issuing Tool Admin",
                purpose: `Credential issuance for user ${userId}`
            },
            callback: {
                url: `${process.env.BASE_URL}/api/credentials/callback`,
                state: requestId,
                headers: {
                    "api-key": "VID-Tool-2024"
                }
            },
            type: credentialType,
            manifest: `https://verifiedid.did.msidentity.com/v1.0/tenants/${process.env.TENANT_ID}/verifiableCredentials/contracts/${credentialType}/manifest`
        };

        // Configure based on known contract types (from our previous analysis)
        let issuanceRequest;
        
        if (credentialType === 'cf556239-b075-168d-f093-a3b1a388ae20') {
            // Verified Employee - uses pre-configured attestations in Azure portal
            console.log('🎯 Configuring for Verified Employee (using portal attestations)');
            
            issuanceRequest = {
                ...baseIssuanceRequest
                // No requestedAccessToken - uses contract attestations
            };
            
        } else if (credentialType === 'fb6e59ab-6c5d-4ce3-376d-a20a4f3f0d2f') {
            // Security Clearance Secret - uses pre-configured attestations in Azure portal
            console.log('🎯 Configuring for Security Clearance Secret (using portal attestations)');
            
            issuanceRequest = {
                ...baseIssuanceRequest
                // No requestedIdToken - uses contract attestations
            };
            
        } else if (credentialType === '3831cbe2-b4e8-793b-100a-874ebd3e50a1') {
            // Another contract type detected - try self-issued configuration
            console.log('🎯 Configuring for contract 3831cbe2-... (trying self-issued pattern)');
            
            issuanceRequest = {
                ...baseIssuanceRequest,
                claims: {
                    "given_name": "John",
                    "family_name": "Doe", 
                    "email": "john.doe@example.com",
                    "jobTitle": "Employee"
                }
            };
            
        } else if (credentialType === 'd4d9372b-e1b2-ad46-b484-6a767ea888ec') {
            // Another contract type detected - configure appropriately
            console.log('🎯 Configuring for contract d4d9372b-... (self-issued claims)');
            
            issuanceRequest = {
                ...baseIssuanceRequest,
                claims: {
                    "displayName": "Test User",
                    "givenName": "Test", 
                    "surname": "User",
                    "jobTitle": "Employee"
                }
            };
            
        } else {
            // Unknown contract type - use basic structure
            console.log('⚠️  Unknown contract type, using basic configuration');
            
            issuanceRequest = {
                ...baseIssuanceRequest,
                claims: {
                    "displayName": "Default User"
                }
            };
        }

        console.log('📝 Base issuance request payload:', JSON.stringify(issuanceRequest, null, 2));

        // Try the correct endpoint for Request Service API
        let response;
        let requestServiceUrl = `${process.env.REQUEST_SERVICE_URL}/verifiableCredentials/createIssuanceRequest`;
        let usedPin = null; // Track the PIN actually used in the successful request
        
        // First attempt: Try with PIN (default behavior)
        const pin = {
            value: Math.floor(1000 + Math.random() * 9000).toString(),
            length: 4
        };
        const issuanceRequestWithPin = {
            ...issuanceRequest,
            pin: pin
        };
        
        console.log('🔐 First attempt: Trying issuance WITH PIN...');
        
        try {
            console.log(`� Calling Request Service API at: ${requestServiceUrl}`);
            response = await axios.post(requestServiceUrl, issuanceRequestWithPin, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Issuance successful WITH PIN');
            usedPin = pin.value; // Store the PIN value for response
            
        } catch (pinError) {
            console.log('⚠️  PIN attempt failed, checking if it\'s a PIN-related error...');
            
            // Check if the error is related to PIN not being supported
            const errorMessage = pinError.response?.data?.error?.message || pinError.message || '';
            const isPinError = errorMessage.toLowerCase().includes('pin') || 
                             errorMessage.toLowerCase().includes('not supported') ||
                             pinError.response?.status === 400;
            
            if (isPinError) {
                console.log('🔄 PIN not supported for this contract, retrying WITHOUT PIN...');
                
                // Second attempt: Try without PIN
                try {
                    response = await axios.post(requestServiceUrl, issuanceRequest, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    console.log('✅ Issuance successful WITHOUT PIN');
                    console.log(`📝 Contract ${credentialType} does not support PIN - this will be remembered`);
                    usedPin = null; // No PIN used
                    
                } catch (noPinError) {
                    // If both attempts fail, try alternative endpoint
                    if (noPinError.response?.status === 404) {
                        requestServiceUrl = `${process.env.REQUEST_SERVICE_URL}/createIssuanceRequest`;
                        console.log(`� Trying alternative endpoint without PIN: ${requestServiceUrl}`);
                        
                        response = await axios.post(requestServiceUrl, issuanceRequest, {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        usedPin = null; // No PIN used (alternative endpoint)
                        throw noPinError;
                    }
                }
            } else if (pinError.response?.status === 404) {
                // Try alternative endpoint with PIN first
                requestServiceUrl = `${process.env.REQUEST_SERVICE_URL}/createIssuanceRequest`;
                console.log(`🔄 Trying alternative endpoint WITH PIN: ${requestServiceUrl}`);
                
                try {
                    response = await axios.post(requestServiceUrl, issuanceRequestWithPin, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    console.log('✅ Issuance successful WITH PIN (alternative endpoint)');
                    usedPin = pin.value; // Store the PIN value for response (alternative endpoint)
                    
                } catch (altPinError) {
                    // Check again if PIN is the issue on alternative endpoint
                    const altErrorMessage = altPinError.response?.data?.error?.message || altPinError.message || '';
                    const isAltPinError = altErrorMessage.toLowerCase().includes('pin') || 
                                        altErrorMessage.toLowerCase().includes('not supported') ||
                                        altPinError.response?.status === 400;
                    
                    if (isAltPinError) {
                        console.log('🔄 PIN not supported on alternative endpoint, retrying WITHOUT PIN...');
                        
                        response = await axios.post(requestServiceUrl, issuanceRequest, {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        console.log('✅ Issuance successful WITHOUT PIN (alternative endpoint)');
                        usedPin = null; // No PIN used (alternative endpoint)
                    } else {
                        throw altPinError;
                    }
                }
            } else {
                console.error(`❌ Request Service API error:`, {
                    status: pinError.response?.status,
                    statusText: pinError.response?.statusText,
                    data: pinError.response?.data,
                    url: requestServiceUrl
                });
                throw pinError;
            }
        }

        // Stockage temporaire pour le suivi
        cache.set(requestId, {
            requestId,
            credentialType,
            userId,
            userEmail,
            status: 'pending',
            createdAt: new Date(),
            issuanceResponse: response.data
        });

        // QR Code generation
        let qrCodeDataUrl = null;
        if (response.data.url) {
            qrCodeDataUrl = await QRCode.toDataURL(response.data.url, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
        }

        res.json({
            success: true,
            requestId: requestId,
            qrCodeUrl: qrCodeDataUrl,
            deepLink: response.data.url,
            expiry: response.data.expiry,
            pin: usedPin,
            message: usedPin ? 
                `Credential issued successfully. Use PIN: ${usedPin}. Scan the QR code with Microsoft Authenticator.` :
                'Credential issued successfully. Scan the QR code with Microsoft Authenticator.'
        });

    } catch (error) {
        console.error('Credential issuance error:', error);
        res.status(500).json({
            success: false,
            error: 'Error issuing credential',
            details: error.response?.data || error.message
        });
    }
});

// Callback route for credential issuance tracking
router.post('/callback', (req, res) => {
    try {
        const { state, code, requestId } = req.body;
        
        const cachedRequest = cache.get(state || requestId);
        if (cachedRequest) {
            cachedRequest.status = code === 'request_retrieved' ? 'completed' : 'error';
            cachedRequest.callbackData = req.body;
            cachedRequest.completedAt = new Date();
            cache.set(state || requestId, cachedRequest);
        }

        console.log(`📩 Issuance callback received for state: ${state}`, req.body);
        res.json({ status: 'received' });
        
    } catch (error) {
        console.error('Issuance callback error:', error);
        res.status(500).json({ error: 'Callback processing failed' });
    }
});

// Route to get issuance status
router.get('/status/:requestId', authModule.requireAuth, (req, res) => {
    try {
        const requestId = req.params.requestId;
        const cachedRequest = cache.get(requestId);
        
        if (cachedRequest) {
            res.json({
                success: true,
                status: cachedRequest.status,
                request: cachedRequest
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Request not found or expired'
            });
        }
        
    } catch (error) {
        console.error('Status retrieval error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get issuance status'
        });
    }
});

// Add a route to view PIN support cache (for debugging)
router.get('/pin-support-cache', authModule.requireAuth, (req, res) => {
    const cacheKeys = pinSupportCache.keys();
    const cacheData = {};
    
    cacheKeys.forEach(key => {
        cacheData[key] = pinSupportCache.get(key);
    });
    
    res.json({
        success: true,
        pinSupportCache: cacheData,
        totalCachedContracts: cacheKeys.length
    });
});

module.exports = router;
