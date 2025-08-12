# Deployment Fixes Log

## Issue #121: Admin App CORS Issue

**Date**: 2025-08-12  
**Branch**: fix/121-admin-cors-issue  

### Problem
Admin app at `https://a.letsorder.app` was unable to make API requests to `https://api.letsorder.app/auth/login` due to CORS policy blocking:

```
Access to fetch at 'https://api.letsorder.app/auth/login' from origin 'https://a.letsorder.app' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the 
requested resource.
```

### Root Cause
The production server was still using the HTTP-only nginx configuration instead of the HTTPS configuration with proper CORS headers. This caused:
1. CloudFlare to receive HTTP 521 errors when trying to connect to the origin
2. No CORS headers being sent in responses
3. Admin app unable to make cross-origin requests

### Solution
Deployed the correct nginx configuration that:
1. Uses Let's Encrypt SSL certificates for HTTPS
2. Includes proper CORS headers for `https://a.letsorder.app` origin
3. Handles preflight OPTIONS requests correctly

### Commands Executed
```bash
# Upload HTTPS nginx configuration
scp deployment/config/nginx.conf letsorder@51.159.134.32:/tmp/nginx-https.conf

# Deploy configuration
ssh letsorder@51.159.134.32 'sudo cp /tmp/nginx-https.conf /etc/nginx/sites-available/letsorder'

# Test and reload
ssh letsorder@51.159.134.32 'sudo nginx -t'
ssh letsorder@51.159.134.32 'sudo systemctl reload nginx'
```

### Verification
After deployment:
- HTTPS endpoints return proper CORS headers
- OPTIONS preflight requests work correctly
- Admin app can successfully make API requests
- CloudFlare integration working properly

### CORS Headers Confirmed
```
access-control-allow-origin: https://a.letsorder.app
access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS
access-control-allow-headers: Authorization, Content-Type
access-control-max-age: 86400
```

### Resolution Status
✅ **RESOLVED** - Admin app CORS issue fixed by deploying correct nginx configuration.