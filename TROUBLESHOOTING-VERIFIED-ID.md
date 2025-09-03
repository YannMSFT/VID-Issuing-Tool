# 🔧 Guide de dépannage Verified ID

## Erreur : "Aucun credential configuré. Vérifiez votre configuration Entra ID."

Cette erreur indique que Microsoft Entra Verified ID n'est pas configuré correctement dans votre tenant.

### ✅ Checklist de diagnostic

#### 1. Vérifier si Verified ID est activé dans votre tenant

1. Allez sur https://portal.azure.com
2. Cherchez "Entra ID" ou "Azure Active Directory"
3. Dans le menu de gauche, cherchez **"Verified ID"**
4. **Si vous ne voyez pas "Verified ID"** → Le service n'est pas activé
5. **Si vous voyez "Set up"** → Il faut configurer le service

#### 2. Activer Microsoft Entra Verified ID

1. Dans **Entra ID** → **Verified ID**
2. Cliquez sur **"Set up"**
3. Suivez l'assistant :
   - Choisir le réseau : **ION (recommandé)**
   - Configurer votre domaine web
   - Accepter les termes et conditions
   - Créer votre DID (Decentralized Identity)

#### 3. Créer votre premier Credential

1. Une fois Verified ID configuré, allez dans **Credentials**
2. Cliquez **"Create credential"**
3. Exemple de configuration :
   ```
   Display name: Employee Badge
   Issuer: Votre Organisation
   
   Claims (champs):
   - given_name (Prénom)
   - family_name (Nom)
   - jobTitle (Poste)
   - email (Email)
   ```

#### 4. Récupérer les vraies valeurs de configuration

Après configuration, vous obtiendrez :

1. **DID Authority** : Disponible dans Verified ID → Organization settings
   Format : `did:web:verifiedid.entra.microsoft.com:VOTRE_TENANT_ID:VOTRE_GUID`

2. **Credential Contract URL** : Visible dans chaque credential créé

#### 5. Mettre à jour votre fichier .env

```bash
# Remplacez ces valeurs par vos vraies valeurs
DID_AUTHORITY=did:web:verifiedid.entra.microsoft.com:d3bd8589-6d49-4b8e-bc91-7d86b2a9ca94:VOTRE_VRAIE_GUID
ISSUER_AUTHORITY=did:web:verifiedid.entra.microsoft.com:d3bd8589-6d49-4b8e-bc91-7d86b2a9ca94:VOTRE_VRAIE_GUID

# L'endpoint peut changer selon votre région
VERIFIABLE_CREDENTIALS_ENDPOINT=https://verifiedid.did.msidentity.com/v1.0/verifiableCredentials/contracts
```

### 🆘 Si Verified ID n'est pas disponible dans votre tenant

Verified ID peut ne pas être disponible sur tous les tenants. Vérifiez :

1. **Licensing** : Certaines licences sont requises
2. **Région** : Le service peut ne pas être disponible dans toutes les régions
3. **Type de tenant** : Peut être limité aux tenants entreprise

### 🎯 Mode Demo

En attendant la configuration complète, l'application fonctionne en **mode demo** :
- Données utilisateur simulées
- Credentials d'exemple
- QR codes fonctionnels pour test

### 📞 Support

Si vous continuez à avoir des problèmes :
1. Utilisez l'onglet **Troubleshoot** de l'application
2. Vérifiez les logs dans la console du navigateur (F12)
3. Consultez la documentation officielle Microsoft Verified ID

---

## Permissions requises pour l'application Entra ID

Votre app registration `3facbd7f-61f3-45ec-be1f-3ce4df602c38` doit avoir :

### API Permissions (Microsoft Graph) :
- `User.Read.All` (Application)
- `Directory.Read.All` (Application)
- `User.Read` (Delegated)

### Verified Credentials Permissions :
- `VerifiableCredential.Create.All` (si disponible dans votre tenant)

N'oubliez pas de **Grant admin consent** pour toutes les permissions !
