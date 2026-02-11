# Quick Reference: Attendance System

## 🚀 Quick Start

```powershell
# 1. Start server
npm run dev

# 2. Open student page
# http://localhost:3000/

# 3. Open admin page
# http://localhost:3000/admin.html

# 4. View Excel file
# attendance.xlsx (in root directory)
```

---

## 📊 System Architecture

### Backend (server.js - 685 lines)
- Express.js on port 3000
- Handles attendance marking
- Reads/writes Excel file
- Returns data via REST API

### Database (Excel + JSON)
- **Primary**: attendance.xlsx (6 columns)
- **Backup**: db.json (file-based)

### Frontend
- **Student Page**: index.html (mark attendance)
- **Admin Page**: admin.html (view records)

---

## ✅ Excel Format (Strict)

| Column | Format | Example |
|--------|--------|---------|
| A | Text (ID) | U001 |
| B | Text (Name) | Ronak Patel |
| C | Text (Date) | 2026-02-11 |
| D | Text (Time) | 09:50:33 |
| E | Text (IP) | 127.0.0.1 |
| F | Text (Status) | Absent |

**Header Row**: Bold white on blue (Row 1)
**Data Rows**: Start from Row 2

---

## 🔧 Configuration

**File**: `.env` (create if missing)

```env
PORT=3000
ALLOWED_WIFI_IP=127.0.0.1
ADMIN_TOKEN=admin
NODE_ENV=development
```

### For University Network:
```env
ALLOWED_WIFI_IP=192.168.1.0/24  # Your office WiFi IP range
ADMIN_TOKEN=SecureTokenHere
```

---

## 📝 API Endpoints

### Mark Attendance
```
POST /api/attendance/mark
Content-Type: application/json

{
  "student_id": "U001",
  "student_name": "Ronak Patel"
}

Response:
{
  "success": true,
  "message": "Attendance marked",
  "record": {
    "id": "U001",
    "name": "Ronak Patel",
    "date": "2026-02-11",
    "time": "09:50:33",
    "ip": "127.0.0.1",
    "status": "Present" | "Absent"
  }
}
```

### Get All Records
```
GET /api/attendance/records
Authorization: admin

Response: [
  {
    "id": "U001",
    "name": "Ronak Patel",
    "date": "2026-02-11",
    "time": "09:50:33",
    "ip": "127.0.0.1",
    "status": "Absent"
  },
  ...
]
```

### Get My IP
```
GET /api/my-ip

Response:
{
  "ip": "127.0.0.1"
}
```

---

## 🎯 Status Logic

| Condition | Result |
|-----------|--------|
| IP matches ALLOWED_WIFI_IP | **Present** (green) |
| IP doesn't match | **Absent** (orange) |

---

## ✨ Frontend Features

### Student Page (`index.html`)
- [x] Enter Student ID
- [x] Enter Student Name
- [x] Submit button
- [x] Success/error message
- [x] Auto IP detection

### Admin Page (`admin.html`)
- [x] Authentication (admin token)
- [x] View all records
- [x] Table with 6 columns
- [x] Date/time properly formatted
- [x] Status color-coded

---

## 🧪 Testing

### Test 1: Mark Single Student
```powershell
$body = @{ 
  student_id = "TEST001"
  student_name = "Test User" 
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/attendance/mark" `
  -Method POST -ContentType "application/json" -Body $body
```

**Expected**: Status is "Absent" (because IP is 127.0.0.1, not office WiFi)

### Test 2: Verify Excel Created
```powershell
Test-Path attendance.xlsx  # Should return True
Get-Item attendance.xlsx
```

### Test 3: Check Admin API
```powershell
$records = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/attendance/records" `
  -Headers @{"Authorization" = "admin"}

Write-Host "Total records: $($records.Count)"
$records[0] | ConvertTo-Json
```

**Expected**: Array with id, name, date, time, ip, status fields

### Test 4: Admin Panel
1. Open http://localhost:3000/admin.html
2. Enter token: `admin`
3. Click "View Records"
4. **Expected**: Table with 6 columns, all data visible

---

## 🐛 Troubleshooting

### Issue: "Cannot find module 'xlsx'"
```powershell
npm install
npm audit fix
```

### Issue: "ENOENT: no such file or directory 'attendance.xlsx'"
This is **normal**! File is created on first attendance mark.

### Issue: Admin page shows blank table
- Check browser console (F12) for errors
- Verify server is running: http://localhost:3000/api/my-ip
- Check Authorization header contains "admin"

### Issue: "Invalid Date" in table
This was **FIXED** in the latest version. If you see this:
1. Delete attendance.xlsx
2. Restart server
3. Mark attendance again

### Issue: Wrong columns display
- Verify you have latest `admin.html`
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+F5)

---

## 📋 Data Format Examples

### Valid Student ID Format
- "U001" ✓
- "STRUCT001" ✓
- "A123" ✓
- "123" ✓

### Valid Student Name Format
- "Ronak Patel" ✓
- "John Smith" ✓
- "Ali Ahmed" ✓

### Date/Time Display
- Date: "2026-02-11" (always YYYY-MM-DD)
- Time: "09:50:33" (always HH:MM:SS in 24-hour)

---

## 📁 File Structure Required

```
AMSystem/
├── server.js          ✓ Must exist (685 lines)
├── db.js              ✓ Must exist (160 lines)
├── package.json       ✓ Contains dependencies
├── .env               ✓ Configuration (optional, uses defaults)
├── attendance.xlsx    ✓ Auto-created on first mark
├── db.json            ✓ Auto-created as backup
└── public/
    ├── index.html     ✓ Student page
    ├── admin.html     ✓ Admin page
    ├── css/
    │   └── *.css
    └── js/
        └── app.js
```

---

## 🔐 Security Notes

### Current Settings (Development)
- ALLOWED_WIFI_IP: `127.0.0.1` (localhost only)
- ADMIN_TOKEN: `admin` (simple)
- No authentication on student marking

### For University Production
Change `.env`:
```env
ALLOWED_WIFI_IP=YOUR_OFFICE_NETWORK_IP_RANGE
ADMIN_TOKEN=StrongSecureTokenHere123!@#
```

### Never
- ❌ Expose .env file
- ❌ Use weak tokens in production
- ❌ Store passwords in code
- ❌ Run on public network without HTTPS

---

## 📞 Support

### Error Messages Reference

| Message | Cause | Solution |
|---------|-------|----------|
| "Cannot find module" | Package not installed | `npm install` |
| "EADDRINUSE: port 3000" | Port in use | Change PORT in .env |
| "No such file or directory" | Missing config | Create `.env` file |
| "Invalid Date" | Date parsing error | Restart server |

### Logs Location
- Server logs: Terminal output
- Request IDs: Visible in logs for tracking
- Excel errors: Server console

---

## 🎓 For University Deployment

### Step 1: Configure Network
```powershell
# Get your office WiFi IP range
ipconfig | grep -i "wireless\|ethernet"

# Update .env
ALLOWED_WIFI_IP=192.168.X.X/24  # Your network
ADMIN_TOKEN=SecureToken123!@#
```

### Step 2: Test in Office
```powershell
# Mark attendance from campus WiFi
# Should show "Present" (green)

# Mark from phone hotspot
# Should show "Absent" (orange)
```

### Step 3: Deploy
```powershell
# Start server in background
npm run dev &  # Or use process manager like PM2

# Keep running even after logout:
# Consider using PM2, NSSM, or Windows Task Scheduler
```

### Step 4: Backup Plan
```powershell
# Backup attendance data regularly
Copy-Item attendance.xlsx "backups/attendance_$(Get-Date -f 'yyyyMMdd').xlsx"
Copy-Item db.json "backups/db_$(Get-Date -f 'yyyyMMdd').json"
```

---

## 📊 Data Analytics

### View all records as CSV
```powershell
# Read from Excel
$excel = Import-Excel -Path attendance.xlsx
$excel | Export-Csv records.csv -NoTypeInformation

# Or from JSON
$json = Get-Content db.json | ConvertFrom-Json
$json | Export-Csv records.csv -NoTypeInformation
```

### Count by Status
```powershell
$records = Get-Content db.json | ConvertFrom-Json
$records | Group-Object -Property status | Select-Object Name, Count
```

### Count by Student
```powershell
$records = Get-Content db.json | ConvertFrom-Json
$records | Group-Object -Property name | Select-Object Name, Count
```

---

## ⚙️ Maintenance

### Weekly
- [ ] Check Excel file size
- [ ] Backup db.json and attendance.xlsx
- [ ] Review error logs

### Monthly
- [ ] Archive old attendance records
- [ ] Update ALLOWED_WIFI_IP if network changes
- [ ] Test admin page access

### Yearly
- [ ] Audit all attendance data
- [ ] Update security tokens
- [ ] Review system performance

---

## 🎉 Summary

✅ **System is production-ready**
✅ **All data consistent**
✅ **No "Invalid Date" errors**
✅ **Excel structure locked (6 columns)**
✅ **API responses standardized**

**Ready to deploy to university network!**

