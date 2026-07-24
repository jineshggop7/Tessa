# Network Configuration Guide

## Accessing from Different Devices/IPs

### Backend Configuration
The backend is already configured to accept connections from all IPs:
- Host: `0.0.0.0` (listens on all network interfaces)
- Port: `8000`
- CORS: Allows all origins

### Frontend Configuration

#### 1. For Local Development (Same Machine)
Just use the regular start command:
```bash
npm start
```
This uses `http://localhost:8000` for the backend.

#### 2. For Network Access (Different Devices)

**Step 1: Find your backend server's IP address**
Run in PowerShell:
```powershell
ipconfig
```
Look for "IPv4 Address" (e.g., `192.168.1.100`)

**Step 2: Update the production environment file**
Edit `src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'http://YOUR_IP_ADDRESS:8000',  // Replace with your actual IP
  wsUrl: 'ws://YOUR_IP_ADDRESS:8000'
};
```

**Step 3: Start the frontend with network access**
```bash
npm run start:network
```
This will make the Angular app accessible from other devices on your network.

**Step 4: Access from other devices**
From other devices, open a browser and navigate to:
```
http://YOUR_IP_ADDRESS:4200
```

### Quick Commands

**Start backend (from Backend folder):**
```bash
python main.py
```

**Start frontend for local access:**
```bash
npm start
```

**Start frontend for network access:**
```bash
npm run start:network
```

**Build for production:**
```bash
npm run build:prod
```

### Troubleshooting

1. **Cannot connect from other devices?**
   - Check your firewall settings
   - Ensure ports 8000 (backend) and 4200 (frontend) are open
   - Make sure both devices are on the same network

2. **CORS errors?**
   - Already configured to allow all origins
   - If still having issues, check browser console for specific errors

3. **WebSocket connection fails?**
   - Verify the wsUrl in environment files matches your backend IP
   - Check that WebSocket connections aren't blocked by firewall
