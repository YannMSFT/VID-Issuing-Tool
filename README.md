# VID Issuing Tool - Administration Tool for Verified Credentials

This application allows administrators to issue Verified Credentials from an Entra ID tenant, with an intuitive interface for selecting users, managing issuance, and performing troubleshooting.

## 🚀 Features

- **Modern and responsive** administration interface
- **Entra ID authentication** to secure access
- **List of credentials** available in the tenant
- **User selection** with search within the tenant
- **Credential issuance** with automatic QR Code generation
- **Microsoft Authenticator integration** via QR Code and deep links
- **Real-time monitoring** of issuances
- **Troubleshooting tools** and diagnostics
- **Statistics and logs** for operation tracking

## 📋 Prerequisites

- Node.js 16+ 
- An Entra ID tenant with Verified Credentials configured
- An Entra ID application with appropriate permissions

## ⚙️ Entra ID Configuration

### 1. Configure Verified Credentials in your tenant

1. Access the Entra ID portal: https://entra.microsoft.com
2. Navigate to **Identity > Verified ID > Setup**
3. Follow the steps to configure your authority and create your credential contracts

### 2. Create an Entra ID application

1. Go to **App registrations** > **New registration**
2. Configure the basic settings:
   - **Name**: `VID Issuing Tool`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: Select `Web` and enter `http://localhost:3000/auth/callback`
3. Click **Register**
4. Note the **Client ID** and **Tenant ID** from the **Overview** page
5. Create a **Client Secret** in **Certificates & secrets** > **New client secret**

### 3. Configure redirect URLs (IMPORTANT)

⚠️ **Critical step**: In your App Registration, you must add the callback URL:

1. In your App Registration, go to **Authentication**
2. Under **Redirect URIs**, make sure you have:
   - `http://localhost:3000/auth/callback` (Web)
3. If you change the application port, update this URL accordingly
4. Click **Save**

### 4. Required permissions

Add the following permissions in **API permissions**:

#### Microsoft Graph Permissions
- **Microsoft Graph**:
  - `User.Read.All` (Application)
  - `Directory.Read.All` (Application)

#### Verified Credentials Service Admin Permissions (MANDATORY)
- **Verifiable Credentials Service Admin** (`6a8b4b39-c021-437c-b060-5a14a3fd65f3`):
  - `VerifiableCredential.Authority.ReadWrite` (Application) - To read configured authorities
  - `VerifiableCredential.Contract.ReadWrite` (Application) - To read credential contracts
  - `VerifiableCredential.Credential.Search` (Application) - To search issued credentials

#### How to add the Verifiable Credentials Service Admin API:

1. In your App Registration, go to **API permissions**
2. Click **Add a permission**
3. Go to the **My organization uses** tab 
4. Search for `Verifiable Credentials Service Admin` or use the ID: `6a8b4b39-c021-437c-b060-5a14a3fd65f3`
5. Select **Application permissions**
6. Check the permissions listed above
7. Click **Add permissions**

⚠️ **IMPORTANT**: Don't forget to grant **admin consent** for all these permissions.

#### Permission verification:

Once configured, your permissions should look like this:
- Microsoft Graph (3 permissions)
  - Directory.Read.All
  - User.Read.All  
  - User.Read (automatic)
- Verifiable Credentials Service Admin (3 permissions)
  - VerifiableCredential.Authority.ReadWrite
  - VerifiableCredential.Contract.ReadWrite
  - VerifiableCredential.Credential.Search

## 🔧 Installation

1. **Clone and install dependencies**:
```bash
npm install
```

2. **Configure environment variables**:
```bash
# Copy the example file
cp .env.example .env
```

3. **Edit the .env file** with your parameters:
```env
# Entra ID Configuration
TENANT_ID=your-tenant-id-here
CLIENT_ID=your-client-id-here  
CLIENT_SECRET=your-client-secret-here

# Verified Credentials Configuration (Admin API)
VERIFIABLE_CREDENTIALS_ENDPOINT=https://verifiedid.did.msidentity.com/v1.0/verifiableCredentials
REQUEST_SERVICE_URL=https://verifiedid.did.msidentity.com/v1.0
VERIFIABLE_CREDENTIALS_API_SCOPE=6a8b4b39-c021-437c-b060-5a14a3fd65f3/.default
DID_AUTHORITY=did:web:your-domain.com
ISSUER_AUTHORITY=your-issuer-authority-here

# Server Configuration
PORT=3000
SESSION_SECRET=your-strong-session-secret-here
BASE_URL=http://localhost:3000
REDIRECT_URI=http://localhost:3000/auth/callback
POST_LOGOUT_REDIRECT_URI=http://localhost:3000
```

4. **⚠️ IMPORTANT - Synchronize URLs**:
   - The `REDIRECT_URI` values in the .env file must exactly match the **Redirect URIs** configured in your Entra ID App Registration
   - If you change the `PORT`, remember to update:
     - The `.env` file (BASE_URL, REDIRECT_URI, POST_LOGOUT_REDIRECT_URI)
     - Your App Registration configuration in Entra ID

## 🚀 Getting Started

### Development mode
```bash
npm run dev
```

### Production mode
```bash
npm start
```

The application will be available at: http://localhost:3000

## 📝 Important Notes

### Verified Credentials Admin API
This application uses the **Microsoft Entra Verified ID Admin API** to:
- Automatically list all authorities configured in your tenant
- Retrieve all available credential types (contracts)  
- Enable credential issuance with proper permissions

### Automatic demo mode
If permissions are not yet configured or no credentials are available, the application will automatically switch to **demo mode** with example credentials to allow you to test the interface.

## 📖 Usage

### 1. Authentication
- Access the application
- Click "Sign in with Microsoft"
- Authenticate with an administrator account

### 2. Credential Issuance

1. **"Issue Credentials" Tab**:
   - Select a credential type from the list
   - Search and select a user
   - Add additional claims if needed (JSON format)
   - Click "Issue Credential"

2. **QR Code**:
   - A QR Code is generated automatically
   - The user can scan it with Microsoft Authenticator
   - A deep link is also provided

### 3. Troubleshooting

1. **"Troubleshooting" Tab**:
   - Test the configuration
   - View recent errors
   - Manage the application cache
   - View system information

## 🔒 Security

- The application uses Entra ID authentication
- Sessions are secured with HttpOnly cookies
- Secrets are stored in environment variables
- Access tokens are managed automatically

## 🛠️ API Endpoints

### Authentication
- `GET /auth/login` - Initiate login
- `GET /auth/callback` - OAuth callback
- `GET /auth/status` - Check authentication status
- `GET /auth/logout` - Logout

### Credentials
- `GET /api/credentials/list` - List available credentials
- `POST /api/credentials/issue` - Issue a credential
- `GET /api/credentials/status/:id` - Status of an issuance
- `GET /api/credentials/pending` - Pending issuances

### Users  
- `GET /api/users/list` - List users
- `GET /api/users/:id` - User details
- `POST /api/users/search` - Advanced search

### Administration
- `GET /api/admin/stats` - Statistics
- `GET /api/admin/logs` - Detailed logs
- `POST /api/admin/cleanup` - Cache cleanup
- `GET /api/admin/test-config` - Configuration test
- `GET /api/admin/troubleshoot` - Troubleshooting information

## 🐛 Troubleshooting

### Common errors

1. **"AADSTS50011: The reply URL specified in the request does not match the reply URLs configured for the application"**
   - Verify that the URL `http://localhost:3000/auth/callback` is properly configured in your App Registration
   - Go to **App registrations** > Your app > **Authentication** > **Redirect URIs**
   - If you're using a different port, update the URL accordingly

2. **"AADSTS900023: Specified tenant identifier is neither a valid DNS name"**
   - Verify that the TENANT_ID in your .env file is correct
   - The format should be: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - Do not include prefixes like "common" or "organizations"

3. **"Unable to obtain access token"**
   - Check the CLIENT_ID, CLIENT_SECRET and TENANT_ID parameters
   - Make sure the application has the correct permissions

4. **"Error loading credentials"**
   - Verify that Verified Credentials is configured in your tenant
   - Check the VERIFIABLE_CREDENTIALS_ENDPOINT URL

5. **"AADSTS500011: The resource principal named https://verifiedid.did.msidentity.com was not found"**
   - This error indicates that permissions for the Verified Credentials Service Admin API are not configured
   - Add the API `6a8b4b39-c021-437c-b060-5a14a3fd65f3` to your application permissions
   - Grant admin consent for all Verified Credentials permissions

6. **"No credentials configured. Check your Entra ID configuration."**
   - Verify that you have created at least one authority and contract in your tenant
   - Go to Entra ID portal > Identity > Verified ID > Setup
   - Create an authority and configure at least one credential type

7. **"Issuance error"**
   - Check the ISSUER_AUTHORITY and REQUEST_SERVICE_URL parameters
   - Make sure the credential type exists

8. **"Error: listen EADDRINUSE: address already in use"**
   - Another process is already using the port
   - Change the PORT in the .env file or stop the other process
   - Use `taskkill /f /im node.exe` to stop all Node.js processes

### Logs and diagnostics

- Logs are displayed in the server console
- Use the "Troubleshooting" tab for diagnostics
- Check system information and configuration

## 🤝 Support

This application is designed to facilitate testing and troubleshooting of Verified Credentials. It allows administrators to:
- Quickly test credential issuance
- Diagnose configuration problems
- Train users on the acceptance process

## 📄 License

MIT License - See the LICENSE file for more details.
