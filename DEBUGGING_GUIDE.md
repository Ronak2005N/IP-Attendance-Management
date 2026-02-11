# Attendance System - Debugging Guide

## ✅ Problems Fixed

### 1. **Missing `db.js` Module** (Root Cause of 500 Error)
- **Problem**: `server.js` required `./db` but file didn't exist
- **Solution**: Created `db.js` with full database operations
- **Impact**: Server was crashing on startup with `MODULE_NOT_FOUND`

### 2. **Missing Error Handling**
- **Problem**: Unhandled promise rejections in async routes
- **Solution**: Added `try-catch` blocks with detailed logging in all routes
- **Impact**: Now all errors return proper 500 responses instead of crashing

### 3. **Unsafe IP Extraction**
- **Problem**: Accessing `req.connection.remoteAddress` without null checks
- **Solution**: Safe extraction with fallbacks and error handling
- **Impact**: Request won't crash if IP headers are missing

### 4. **No Global Error Middleware**
- **Problem**: Crashes weren't caught at app level
- **Solution**: Added global error handler + uncaught exception handlers
- **Impact**: All errors now logged and responded to gracefully

---

## 🔍 Testing Steps (Backend Terminal)

### Step 1: Start Server
```powershell
npm run dev
```

**Expected Output:**
```
[INIT] Database module loaded successfully
[SERVER] ✅ Attendance System Server Started
[SERVER] URL: http://localhost:3000
[SERVER] Allowed IP: 127.0.0.1
```

### Step 2: Test GET /api/my-ip (Check Your IP)
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/my-ip" -Method GET | Select-Object -ExpandProperty Content
```

**Expected Output:**
```json
{
  "success": true,
  "clientIp": "127.0.0.1",
  "isPrivate": true,
  "possibleProxy": false,
  "note": "You are on a private/local network"
}
```

**Backend Logs:**
```
[API] GET /api/my-ip - Client IP: 127.0.0.1
```

### Step 3: Mark Attendance
```powershell
$body = @{
    student_id = "12345"
    student_name = "John Doe"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/attendance/mark" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body | Select-Object -ExpandProperty Content
```

**Expected Output:**
```json
{
  "message": "Marked Absent (IP 127.0.0.1 does not match expected IP (none)).",
  "success": true,
  "status": "Absent",
  "clientIp": "127.0.0.1",
  "expectedIp": null,
  "isPrivate": true,
  "proxy": false,
  "reason": "private_ip"
}
```

**Backend Logs:**
```
[abc1234] POST /api/attendance/mark - Request started
[abc1234] Student: 12345 (John Doe)
[abc1234] Client IP: 127.0.0.1
[abc1234] Expected IP: (none), IsPrivate: true, Proxy: false
[abc1234] Marked Absent: Private IP detected (127.0.0.1)
[abc1234] Attendance saved to Excel
[abc1234] Attendance saved to JSON database
[abc1234] Request completed in 45ms
```

### Step 4: Set Expected IP (Admin Only)
```powershell
$body = @{
    student_id = "12345"
    expected_ip = "192.168.1.100"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/set-expected-ip" `
  -Method POST `
  -Headers @{"Authorization" = "admin"} `
  -ContentType "application/json" `
  -Body $body | Select-Object -ExpandProperty Content
```

**Expected Output:**
```json
{
  "success": true,
  "message": "Expected IP saved successfully",
  "student_id": "12345",
  "expected_ip": "192.168.1.100"
}
```

### Step 5: Check Logs for Errors
Always look for these patterns in terminal output:

#### ✅ GOOD (Working)
```
[abc1234] Request completed in 45ms
[DB] Attendance recorded for student 12345
[SERVER] Listening on http://localhost:3000
```

#### ❌ BAD (Errors)
```
[abc1234] UNHANDLED ERROR
[DB] Error saving database
Error marking attendance
```

---

## 🚨 Common Errors & Solutions

### **Error: "MODULE_NOT_FOUND: Cannot find module './db'"**
- **Cause**: Missing `db.js` file
- **Solution**: File should now exist. If not, check that `db.js` was created
- **Check**: `ls db.js` should show the file

### **Error: "Student ID and name are required"**
- **Cause**: Request body missing fields
- **Solution**: Check frontend sending `{ student_id, student_name }`
- **Debug**: Check logs for "Missing student_id"

### **Error: "Database error. Could not retrieve student IP rules"**
- **Cause**: `db.json` corrupted or permissions issue
- **Solution**: Ensure `db.json` is readable/writable
- **Check**: `Test-Path db.json` should return True

### **Error: "Could not determine your IP address"**
- **Cause**: `extractClientIp()` failed
- **Solution**: IP extraction shouldn't fail anymore (has try-catch)
- **Debug**: Check console logs for "[IP_EXTRACT] Error"

### **Error: "Server error saving to Excel"**
- **Cause**: File locked or write permissions issue
- **Solution**: Close Excel if file is open, check folder permissions
- **Debug**: Check logs for "Excel write error" with full stack trace

---

## 📋 What Each Log Level Means

### `[INIT]` - Server Initialization
```
[INIT] Database module loaded successfully - DB is ready
[INIT] FATAL: Failed to load database module - CRITICAL ERROR
```

### `[SERVER]` - Server Status
```
[SERVER] ✅ Attendance System Server Started - Server is running
[SERVER] Listening on http://localhost:3000 - Port is open
```

### `[api_id] POST /api/attendance/mark` - Request Logs
```
[abc1234] Student: 12345 (John Doe) - Identifying the request
[abc1234] Client IP: 127.0.0.1 - IP extraction result
[abc1234] Marked Present: IP matched - Business logic result
[abc1234] Request completed in 45ms - Performance
```

### `[DB]` - Database Operations
```
[DB] Attendance recorded for student 12345 - Successfully saved
[DB] Error loading database - JSON file is corrupted
[DB] Expected IP set for student 12345 - Admin operation
```

### `[API]` - Other Routes
```
[API] GET /api/my-ip - Client IP: 192.168.1.1 - User checking their IP
[API] Unauthorized attempt to set expected IP - Wrong token
```

### `[GLOBAL_ERROR]` - Unhandled Errors
```
[GLOBAL_ERROR] Unhandled Error - Any error not caught elsewhere
Message: [error description]
Stack: [full stack trace]
```

---

## 🔧 Testing Direct HTTP Calls

### Using curl (if installed)
```bash
# Get your IP
curl http://localhost:3000/api/my-ip

# Mark attendance
curl -X POST http://localhost:3000/api/attendance/mark \
  -H "Content-Type: application/json" \
  -d '{"student_id":"12345","student_name":"John Doe"}'

# Admin: Set expected IP
curl -X POST http://localhost:3000/api/set-expected-ip \
  -H "Content-Type: application/json" \
  -H "Authorization: admin" \
  -d '{"student_id":"12345","expected_ip":"192.168.1.100"}'

# Get records (admin)
curl -H "Authorization: admin" http://localhost:3000/api/attendance/records
```

---

## 📊 Edge Cases Handled

| Scenario | Response | Status |
|----------|----------|--------|
| Client on private IP (127.0.0.1) | Marked Absent | 200 OK |
| Student IP matches expected IP | Marked Present | 200 OK |
| Student IP doesn't match | Marked Absent | 200 OK |
| No expected IP configured | Marked Absent | 200 OK |
| Missing student_id in body | Error message | 400 Bad Request |
| Internet disconnected (IP API fails) | Still works (no external API) | ✅ |
| Database corrupted | Falls back to empty DB | ✅ |
| Excel file locked/missing | Creates new one | ✅ |
| Admin token missing | 401 Unauthorized | ✅ |

---

## 💡 Production Checklist

- [ ] Set `ALLOWED_WIFI_IP` in `.env` to your office WiFi IP
- [ ] Set `ADMIN_TOKEN` in `.env` to a long random string
- [ ] Set `NODE_ENV=production` in `.env` to hide error details
- [ ] Ensure `attendance.xlsx` and `db.json` have write permissions
- [ ] Test attendance marking from actual office IP
- [ ] Backup `db.json` and `attendance.xlsx` daily
- [ ] Monitor logs for `[GLOBAL_ERROR]` patterns
- [ ] Test 404 handling with invalid routes
- [ ] Verify admin endpoints require authentication

---

## 📞 If Server Still Crashes

1. Check exact error in terminal:
   ```powershell
   npm run dev 2>&1 | Select-Object -First 100
   ```

2. Check if port 3000 is in use:
   ```powershell
   Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
   ```

3. Clear cache and restart:
   ```powershell
   rm -r node_modules
   npm install
   npm run dev
   ```

4. Check file permissions:
   ```powershell
   Get-Item db.json, attendance.xlsx | Get-Acl
   ```
