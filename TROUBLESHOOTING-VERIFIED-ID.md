# 🔧 Verified ID Troubleshooting Guide

## Error: "No credentials configured. Check your Entra ID configuration."

This error indicates that Microsoft Entra Verified ID is not properly configured in your tenant.

### ✅ Diagnostic Checklist

#### 1. Check if Verified ID is enabled in your tenant

1. Go to https://portal.azure.com
2. Search for "Entra ID" or "Azure Active Directory"
3. In the left menu, look for **"Verified ID"**
4. **If you don't see "Verified ID"** → The service is not activated
5. **If you see "Set up"** → The service needs to be configured

#### 2. Enable Microsoft Entra Verified ID

1. In **Entra ID** → **Verified ID**
2. Click **"Set up"**
3. Follow the wizard:
   - Choose the network: **ION (recommended)**
   - Configure your web domain
   - Accept the terms and conditions
   - Create your DID (Decentralized Identity)

#### 3. Create your first Credential

1. Once Verified ID is configured, go to **Credentials**
2. Click **"Create credential"**
3. Example configuration:
   ```
   Display name: Employee Badge
   Issuer: Your Organization
   
   Claims (fields):
   - given_name (First Name)
   - family_name (Last Name)
   - jobTitle (Job Title)
   - email (Email)
   ```

#### 4. Retrieve the actual configuration values

After configuration, you will obtain:

1. **DID Authority**: Available in Verified ID → Organization settings
   Format: `did:web:verifiedid.entra.microsoft.com:YOUR_TENANT_ID:YOUR_GUID`

2. **Credential Contract URL**: Visible in each created credential

#### 5. Update your .env file

```bash
# Replace these values with your actual values
DID_AUTHORITY=did:web:verifiedid.entra.microsoft.com:d3bd8589-6d49-4b8e-bc91-7d86b2a9ca94:YOUR_ACTUAL_GUID
ISSUER_AUTHORITY=did:web:verifiedid.entra.microsoft.com:d3bd8589-6d49-4b8e-bc91-7d86b2a9ca94:YOUR_ACTUAL_GUID

# The endpoint may change depending on your region
VERIFIABLE_CREDENTIALS_ENDPOINT=https://verifiedid.did.msidentity.com/v1.0/verifiableCredentials/contracts
```

### 🆘 If Verified ID is not available in your tenant

Verified ID may not be available on all tenants. Check:

1. **Licensing**: Certain licenses are required
2. **Region**: The service may not be available in all regions
3. **Tenant type**: May be limited to enterprise tenants

### 🎯 Demo Mode

While waiting for complete configuration, the application works in **demo mode**:
- Simulated user data
- Example credentials
- Functional QR codes for testing

### 📞 Support

If you continue to have problems:
1. Use the **Troubleshoot** tab in the application
2. Check logs in the browser console (F12)
3. Consult the official Microsoft Verified ID documentation

---

## Required permissions for the Entra ID application

Your app registration `3facbd7f-61f3-45ec-be1f-3ce4df602c38` must have:

### API Permissions (Microsoft Graph):
- `User.Read.All` (Application)
- `Directory.Read.All` (Application)
- `User.Read` (Delegated)

### Verified Credentials Permissions:
- `VerifiableCredential.Create.All` (if available in your tenant)

Don't forget to **Grant admin consent** for all permissions!
