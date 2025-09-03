// Script pour lister les contracts disponibles dans votre tenant
const axios = require('axios');
require('dotenv').config();

async function listContracts() {
    try {
        console.log('📋 Liste des contrats Verified Credentials disponibles\n');
        
        // 1. Obtenir un token d'accès pour l'Admin API
        console.log('🔑 Obtention du token d\'accès Admin API...');
        const tokenResponse = await axios.post(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            scope: process.env.VERIFIABLE_CREDENTIALS_API_SCOPE,
            grant_type: 'client_credentials'
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        console.log('✅ Token obtenu avec succès');
        const accessToken = tokenResponse.data.access_token;
        
        // 2. Lister les autorités
        console.log('\n📊 Récupération des autorités...');
        const authoritiesResponse = await axios.get(`${process.env.VERIFIABLE_CREDENTIALS_ENDPOINT}/authorities`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const authorities = authoritiesResponse.data.value || [];
        console.log(`✅ ${authorities.length} autorités trouvées\n`);

        // 3. Pour chaque autorité, lister les contracts
        for (const authority of authorities) {
            console.log(`🏛️  Autorité: ${authority.name} (ID: ${authority.id})`);
            
            try {
                const contractsResponse = await axios.get(`${process.env.VERIFIABLE_CREDENTIALS_ENDPOINT}/authorities/${authority.id}/contracts`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const contracts = contractsResponse.data.value || [];
                console.log(`   📑 ${contracts.length} contrats trouvés:`);
                
                contracts.forEach(contract => {
                    console.log(`      - Nom: ${contract.name}`);
                    console.log(`        ID: ${contract.id}`);
                    console.log(`        Status: ${contract.status}`);
                    console.log(`        Type: ${JSON.stringify(contract.rules?.vc?.type)}`);
                    if (contract.displays && contract.displays.length > 0) {
                        console.log(`        Titre: ${contract.displays[0].card?.title}`);
                    }
                    console.log('');
                });
                
            } catch (error) {
                console.log(`   ❌ Erreur lors de la récupération des contrats: ${error.message}`);
            }
            console.log('');
        }

    } catch (error) {
        console.error('💥 Erreur générale:', error.message);
        if (error.response?.data) {
            console.error('📄 Détails de l\'erreur:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Exécuter le listing
listContracts();
