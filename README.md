# VID Issuing Tool - Outil d'administration pour Verified Credentials

Cette application permet aux administrateurs d'émettre des Verified Credentials depuis un tenant Entra ID, avec une interface intuitive pour sélectionner des utilisateurs, gérer les émissions et effectuer du troubleshooting.

## 🚀 Fonctionnalités

- **Interface d'administration** moderne et responsive
- **Authentification Entra ID** pour sécuriser l'accès
- **Liste des credentials** disponibles dans le tenant
- **Sélection d'utilisateurs** avec recherche dans le tenant
- **Émission de credentials** avec génération automatique de QR Code
- **Intégration Microsoft Authenticator** via QR Code et deep links
- **Monitoring en temps réel** des émissions
- **Outils de troubleshooting** et diagnostics
- **Statistiques et logs** pour le suivi des opérations

## 📋 Prérequis

- Node.js 16+ 
- Un tenant Entra ID avec Verified Credentials configuré
- Une application Entra ID avec les permissions appropriées

## ⚙️ Configuration Entra ID

### 1. Configurer Verified Credentials dans votre tenant

1. Accédez au portail Entra ID : https://entra.microsoft.com
2. Naviguez vers **Identity > Verified ID > Setup**
3. Suivez les étapes pour configurer votre autorité et créer vos contrats de credentials

### 2. Créer une application Entra ID

1. Allez dans **App registrations** > **New registration**
2. Configurez les paramètres de base :
   - **Name**: `VID Issuing Tool`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: Sélectionnez `Web` et entrez `http://localhost:3000/auth/callback`
3. Cliquez sur **Register**
4. Notez le **Client ID** et **Tenant ID** depuis la page **Overview**
5. Créez un **Client Secret** dans **Certificates & secrets** > **New client secret**

### 3. Configurer les URLs de redirection (IMPORTANT)

⚠️ **Étape critique** : Dans votre App Registration, vous devez ajouter l'URL de callback :

1. Dans votre App Registration, allez dans **Authentication**
2. Sous **Redirect URIs**, assurez-vous d'avoir :
   - `http://localhost:3000/auth/callback` (Web)
3. Si vous changez le port de l'application, mettez à jour cette URL en conséquence
4. Cliquez sur **Save**

### 4. Permissions requises

Ajoutez les permissions suivantes dans **API permissions** :

#### Permissions Microsoft Graph
- **Microsoft Graph**:
  - `User.Read.All` (Application)
  - `Directory.Read.All` (Application)

#### Permissions Verified Credentials Service Admin (OBLIGATOIRE)
- **Verifiable Credentials Service Admin** (`6a8b4b39-c021-437c-b060-5a14a3fd65f3`):
  - `VerifiableCredential.Authority.ReadWrite` (Application) - Pour lire les autorités configurées
  - `VerifiableCredential.Contract.ReadWrite` (Application) - Pour lire les contrats de credentials
  - `VerifiableCredential.Credential.Search` (Application) - Pour rechercher les credentials émis

#### Comment ajouter l'API Verifiable Credentials Service Admin :

1. Dans votre App Registration, allez dans **API permissions**
2. Cliquez sur **Add a permission**
3. Allez dans l'onglet **My organization uses** 
4. Recherchez `Verifiable Credentials Service Admin` ou utilisez l'ID : `6a8b4b39-c021-437c-b060-5a14a3fd65f3`
5. Sélectionnez **Application permissions**
6. Cochez les permissions listées ci-dessus
7. Cliquez sur **Add permissions**

⚠️ **IMPORTANT** : N'oubliez pas d'accorder le **consentement administrateur** pour toutes ces permissions.

#### Verification des permissions :

Une fois configurées, vos permissions devraient ressembler à ceci :
- Microsoft Graph (3 permissions)
  - Directory.Read.All
  - User.Read.All  
  - User.Read (automatique)
- Verifiable Credentials Service Admin (3 permissions)
  - VerifiableCredential.Authority.ReadWrite
  - VerifiableCredential.Contract.ReadWrite
  - VerifiableCredential.Credential.Search

## 🔧 Installation

1. **Cloner et installer les dépendances**:
```bash
npm install
```

2. **Configurer les variables d'environnement**:
```bash
# Copier le fichier d'exemple
cp .env.example .env
```

3. **Éditer le fichier .env** avec vos paramètres :
```env
# Configuration Entra ID
TENANT_ID=your-tenant-id-here
CLIENT_ID=your-client-id-here  
CLIENT_SECRET=your-client-secret-here

# Configuration Verified Credentials (API Admin)
VERIFIABLE_CREDENTIALS_ENDPOINT=https://verifiedid.did.msidentity.com/v1.0/verifiableCredentials
REQUEST_SERVICE_URL=https://verifiedid.did.msidentity.com/v1.0
VERIFIABLE_CREDENTIALS_API_SCOPE=6a8b4b39-c021-437c-b060-5a14a3fd65f3/.default
DID_AUTHORITY=did:web:your-domain.com
ISSUER_AUTHORITY=your-issuer-authority-here

# Configuration serveur
PORT=3000
SESSION_SECRET=your-strong-session-secret-here
BASE_URL=http://localhost:3000
REDIRECT_URI=http://localhost:3000/auth/callback
POST_LOGOUT_REDIRECT_URI=http://localhost:3000
```

4. **⚠️ IMPORTANT - Synchroniser les URLs** :
   - Les valeurs `REDIRECT_URI` dans le fichier .env doivent correspondre exactement aux **Redirect URIs** configurées dans votre App Registration Entra ID
   - Si vous changez le `PORT`, pensez à mettre à jour :
     - Le fichier `.env` (BASE_URL, REDIRECT_URI, POST_LOGOUT_REDIRECT_URI)
     - La configuration de votre App Registration dans Entra ID

## 🚀 Démarrage

### Mode développement
```bash
npm run dev
```

### Mode production
```bash
npm start
```

L'application sera disponible sur : http://localhost:3000

## 📝 Notes importantes

### API Admin Verified Credentials
Cette application utilise l'**API Admin de Microsoft Entra Verified ID** pour :
- Lister automatiquement toutes les autorités configurées dans votre tenant
- Récupérer tous les types de credentials (contrats) disponibles  
- Permettre l'émission de credentials avec les bonnes permissions

### Mode démo automatique
Si les permissions ne sont pas encore configurées ou si aucun credential n'est disponible, l'application basculera automatiquement en **mode démo** avec des credentials d'exemple pour vous permettre de tester l'interface.

## 📖 Utilisation

### 1. Authentification
- Accédez à l'application
- Cliquez sur "Se connecter avec Microsoft"
- Authentifiez-vous avec un compte administrateur

### 2. Émission de Credentials

1. **Onglet "Émettre des Credentials"**:
   - Sélectionnez un type de credential dans la liste
   - Recherchez et sélectionnez un utilisateur
   - Ajoutez des claims supplémentaires si nécessaire (format JSON)
   - Cliquez sur "Émettre le Credential"

2. **QR Code**:
   - Un QR Code est généré automatiquement
   - L'utilisateur peut le scanner avec Microsoft Authenticator
   - Un deep link est également fourni

### 3. Monitoring

1. **Onglet "Monitoring"**:
   - Consultez les statistiques globales
   - Visualisez l'activité récente
   - Suivez les émissions en cours

### 4. Troubleshooting

1. **Onglet "Troubleshooting"**:
   - Testez la configuration
   - Consultez les erreurs récentes
   - Gérez le cache de l'application
   - Visualisez les informations système

## 🔒 Sécurité

- L'application utilise l'authentification Entra ID
- Les sessions sont sécurisées avec des cookies HttpOnly
- Les secrets sont stockés dans des variables d'environnement
- Les tokens d'accès sont gérés automatiquement

## 🛠️ API Endpoints

### Authentification
- `GET /auth/login` - Initier la connexion
- `GET /auth/callback` - Callback OAuth
- `GET /auth/status` - Vérifier le statut d'authentification
- `GET /auth/logout` - Déconnexion

### Credentials
- `GET /api/credentials/list` - Lister les credentials disponibles
- `POST /api/credentials/issue` - Émettre un credential
- `GET /api/credentials/status/:id` - Statut d'une émission
- `GET /api/credentials/pending` - Émissions en attente

### Utilisateurs  
- `GET /api/users/list` - Lister les utilisateurs
- `GET /api/users/:id` - Détails d'un utilisateur
- `POST /api/users/search` - Recherche avancée

### Administration
- `GET /api/admin/stats` - Statistiques
- `GET /api/admin/logs` - Logs détaillés
- `POST /api/admin/cleanup` - Nettoyage du cache
- `GET /api/admin/test-config` - Test de configuration
- `GET /api/admin/troubleshoot` - Informations de dépannage

## 🐛 Troubleshooting

### Erreurs courantes

1. **"AADSTS50011: The reply URL specified in the request does not match the reply URLs configured for the application"**
   - Vérifiez que l'URL `http://localhost:3000/auth/callback` est bien configurée dans votre App Registration
   - Allez dans **App registrations** > Votre app > **Authentication** > **Redirect URIs**
   - Si vous utilisez un port différent, mettez à jour l'URL en conséquence

2. **"AADSTS900023: Specified tenant identifier is neither a valid DNS name"**
   - Vérifiez que le TENANT_ID dans votre fichier .env est correct
   - Le format doit être : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - Ne pas inclure de préfixe comme "common" ou "organizations"

3. **"Impossible d'obtenir le token d'accès"**
   - Vérifiez les paramètres CLIENT_ID, CLIENT_SECRET et TENANT_ID
   - Assurez-vous que l'application a les bonnes permissions

4. **"Erreur lors du chargement des credentials"**
   - Vérifiez que Verified Credentials est configuré dans votre tenant
   - Vérifiez l'URL VERIFIABLE_CREDENTIALS_ENDPOINT

5. **"AADSTS500011: The resource principal named https://verifiedid.did.msidentity.com was not found"**
   - Cette erreur indique que les permissions pour l'API Verified Credentials Service Admin ne sont pas configurées
   - Ajoutez l'API `6a8b4b39-c021-437c-b060-5a14a3fd65f3` dans vos permissions d'application
   - Accordez le consentement administrateur pour toutes les permissions Verified Credentials

6. **"No credentials configured. Check your Entra ID configuration."**
   - Vérifiez que vous avez créé au moins une autorité et un contrat dans votre tenant
   - Allez dans le portail Entra ID > Identity > Verified ID > Setup
   - Créez une autorité et configurez au moins un type de credential

7. **"Erreur lors de l'émission"**
   - Vérifiez les paramètres ISSUER_AUTHORITY et REQUEST_SERVICE_URL
   - Assurez-vous que le type de credential existe

6. **"Error: listen EADDRINUSE: address already in use"**
   - Un autre processus utilise déjà le port
   - Changez le PORT dans le fichier .env ou arrêtez l'autre processus
   - Utilisez `taskkill /f /im node.exe` pour arrêter tous les processus Node.js

### Logs et diagnostics

- Les logs sont affichés dans la console du serveur
- Utilisez l'onglet "Troubleshooting" pour les diagnostics
- Vérifiez les informations système et la configuration

## 🤝 Support

Cette application est conçue pour faciliter les tests et le troubleshooting des Verified Credentials. Elle permet aux administrateurs de :
- Tester rapidement l'émission de credentials
- Diagnostiquer les problèmes de configuration
- Former les utilisateurs sur le processus d'acceptation

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.
