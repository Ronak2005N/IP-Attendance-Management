const express = require('express');
const ExcelJS = require('exceljs');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');

// Load environment variables FIRST before importing anything that uses them
dotenv.config();

// Import db module after dotenv is loaded
let db;
try {
  db = require('./db');
  console.log('[INIT] Database module loaded successfully');
} catch (error) {
  console.error('[INIT] FATAL: Failed to load database module:', error.message);
  console.error('[INIT] Exiting...');
  process.exit(1);
}

const app = express(); // Initialize app first

// Middleware - CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration
const PORT = process.env.PORT || 3000;
const ALLOWED_IP = process.env.ALLOWED_WIFI_IP;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Startup validation
if (!ALLOWED_IP) {
  console.warn('[INIT] WARNING: ALLOWED_WIFI_IP not set in .env - students will only be marked present with IP-based rules');
}
if (!ADMIN_TOKEN) {
  console.warn('[INIT] WARNING: ADMIN_TOKEN not set in .env - admin endpoints will be inaccessible');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract client IP from request
 * Tries multiple sources: x-forwarded-for, socket.remoteAddress, connection.remoteAddress
 * Handles IPv6-mapped IPv4, proxy chains, and local loopback
 * 
 * @param {Object} req Express request object
 * @returns {string} Client IP address or empty string if unable to determine
 */
function extractClientIp(req) {
  let ip = '';
  
  try {
    // Priority 1: x-forwarded-for (proxy/load balancer)
    ip = req.headers['x-forwarded-for'];
    
    // Priority 2: socket.remoteAddress (direct connection)
    if (!ip && req.socket && req.socket.remoteAddress) {
      ip = req.socket.remoteAddress;
    }
    
    // Priority 3: connection.remoteAddress (fallback for older Node)
    if (!ip && req.connection && req.connection.remoteAddress) {
      ip = req.connection.remoteAddress;
    }
    
    // Normalize: if x-forwarded-for contains multiple IPs, take the first
    if (ip && ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }
    
    // Remove IPv6 prefix if present (e.g., ::ffff:192.168.1.1 -> 192.168.1.1)
    if (ip && ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }
    
    // Convert IPv6 loopback to IPv4 loopback
    if (ip === '::1') {
      ip = '127.0.0.1';
    }
    
    return ip || '';
  } catch (error) {
    console.error('[IP_EXTRACT] Error extracting IP:', error.message);
    return '';
  }
}

/**
 * Check if IP is in a private range (local network, loopback, etc.)
 * @param {string} ip IP address
 * @returns {boolean} True if private, false otherwise
 */
function isPrivateIp(ip) {
  if (!ip) return false;
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip === '127.0.0.1' ||
    ip === 'localhost'
  );
}

/**
 * Check if request came through a proxy
 * @param {Object} req Express request object
 * @returns {boolean} True if likely behind a proxy
 */
function possibleProxy(req) {
  const raw = req.headers['x-forwarded-for'] || '';
  return raw && raw.split(',').length > 1;
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/attendance/mark
 * Mark attendance for a student based on IP address
 * 
 * Request body:
 *   {
 *     "student_id": "12345",
 *     "student_name": "John Doe"
 *   }
 * 
 * Response:
 *   {
 *     "message": "Successfully marked Present/Absent",
 *     "status": "Present|Absent",
 *     "clientIp": "192.168.1.10",
 *     "expectedIp": "192.168.1.10",
 *     "isPrivate": false,
 *     "proxy": false,
 *     "reason": "ip_matched|ip_mismatch|private_ip|missing_ip"
 *   }
 */
app.post('/api/attendance/mark', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  
  try {
    console.log(`[${requestId}] POST /api/attendance/mark - Request started`);
    
    // ========== VALIDATION ==========
    const { student_id, student_name } = req.body;
    
    if (!student_id || !student_name) {
      console.warn(`[${requestId}] Missing student_id or student_name in request body`);
      return res.status(400).json({
        message: 'Student ID and name are required.',
        success: false,
      });
    }
    
    console.log(`[${requestId}] Student: ${student_id} (${student_name})`);

    // ========== IP EXTRACTION & VALIDATION ==========
    let clientIp = '';
    let allowedIp = '';
    let isPrivate = false;
    let proxy = false;
    let status = 'Absent';
    let reason = null;

    try {
      clientIp = extractClientIp(req) || '';
      if (!clientIp) {
        throw new Error('Unable to extract client IP from request');
      }
      console.log(`[${requestId}] Client IP: ${clientIp}`);
    } catch (ipError) {
      console.error(`[${requestId}] IP extraction error:`, ipError.message);
      return res.status(400).json({
        message: 'Could not determine your IP address.',
        success: false,
      });
    }

    // ========== GET DATABASE RECORDS ==========
    try {
      // Get expected IP from database
      allowedIp = db.getExpectedIp(student_id) || ALLOWED_IP || '';
      
      // Check if IP is private
      isPrivate = isPrivateIp(clientIp);
      proxy = possibleProxy(req);
      
      console.log(`[${requestId}] Expected IP: ${allowedIp || '(none)'}, IsPrivate: ${isPrivate}, Proxy: ${proxy}`);
    } catch (dbError) {
      console.error(`[${requestId}] Database error:`, dbError.message);
      return res.status(500).json({
        message: 'Database error. Could not retrieve student IP rules.',
        success: false,
      });
    }

    // ========== ATTENDANCE LOGIC ==========
    try {
      // Rule 1: Private IP (127.0.0.1, 192.168.x.x, etc.) = Mark Absent
      if (isPrivate) {
        status = 'Absent';
        reason = 'private_ip';
        console.log(`[${requestId}] Marked Absent: Private IP detected (${clientIp})`);
      }
      // Rule 2: No expected IP set = Mark Absent
      else if (!allowedIp) {
        status = 'Absent';
        reason = 'missing_expected_ip';
        console.log(`[${requestId}] Marked Absent: No expected IP configured for student`);
      }
      // Rule 3: IP matches expected = Mark Present
      else if (clientIp === allowedIp) {
        status = 'Present';
        reason = 'ip_matched';
        console.log(`[${requestId}] Marked Present: IP matched (${clientIp})`);
      }
      // Rule 4: IP doesn't match = Mark Absent
      else {
        status = 'Absent';
        reason = 'ip_mismatch';
        console.log(`[${requestId}] Marked Absent: IP mismatch (got ${clientIp}, expected ${allowedIp})`);
      }
    } catch (logicError) {
      console.error(`[${requestId}] Logic error:`, logicError.message);
      return res.status(500).json({
        message: 'Server error processing attendance logic.',
        success: false,
      });
    }

    // ========== PREVENT DUPLICATES ==========
    try {
      const today = new Date().toISOString().slice(0, 10);
      const attendanceToday = db.getAttendanceForStudent(student_id);
      const alreadyMarkedPresent = attendanceToday.find(
        (record) => (record.timestamp || '').slice(0, 10) === today && record.status === 'Present'
      );

      if (alreadyMarkedPresent && status === 'Present') {
        console.log(`[${requestId}] Duplicate present marking prevented for today`);
        return res.json({
          message: `Already marked present today (${alreadyMarkedPresent.timestamp}).`,
          success: true,
          alreadyMarked: true,
          status: 'Present',
        });
      }
    } catch (dupError) {
      console.error(`[${requestId}] Duplicate check error:`, dupError.message);
      // Continue anyway - don't fail the request
    }

    // ========== SAVE TO EXCEL ==========
    try {
      const timestamp = new Date();
      const isoTimestamp = timestamp.toISOString();
      
      // Format: Date as YYYY-MM-DD, Time as HH:MM:SS
      const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = timestamp.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      }); // HH:MM:SS
      
      const workbook = new ExcelJS.Workbook();
      const filePath = path.join(__dirname, 'attendance.xlsx');
      let worksheet;
      let isNewFile = false;

      try {
        await workbook.xlsx.readFile(filePath);
        worksheet = workbook.getWorksheet('Attendance');
        if (!worksheet) {
          throw new Error('Attendance worksheet not found');
        }
        console.log(`[${requestId}] Loaded existing attendance.xlsx`);
      } catch (excelError) {
        console.log(`[${requestId}] Creating new attendance.xlsx`);
        worksheet = workbook.addWorksheet('Attendance');
        isNewFile = true;
        
        // Add header row with EXACT column order required
        // 1. ID, 2. Name, 3. Date, 4. Time, 5. IP Address, 6. Status
        const headerRow = worksheet.addRow([
          'ID',
          'Name',
          'Date',
          'Time',
          'IP Address',
          'Status'
        ]);
        
        // Format header row
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'center' };
        
        // Set column widths to match exact order
        worksheet.columns = [
          { width: 15 }, // ID
          { width: 25 }, // Name
          { width: 15 }, // Date (YYYY-MM-DD)
          { width: 15 }, // Time (HH:MM:SS)
          { width: 18 }, // IP Address
          { width: 12 }  // Status
        ];
      }

      // Add the attendance record row with EXACT column order
      // Must match: ID, Name, Date, Time, IP Address, Status
      const dataRow = worksheet.addRow([
        student_id,        // ID (Column 1)
        student_name,      // Name (Column 2)
        dateStr,           // Date (Column 3)
        timeStr,           // Time (Column 4)
        clientIp,          // IP Address (Column 5)
        status             // Status (Column 6)
      ]);
      
      // Format data row for better visibility
      dataRow.alignment = { horizontal: 'center', vertical: 'center' };
      
      // Color code status cell (Column 6)
      const statusCellAddress = dataRow.getCell(6);
      if (status === 'Present') {
        statusCellAddress.font = { color: { argb: 'FF10b981' }, bold: true };
      } else {
        statusCellAddress.font = { color: { argb: 'FFf97316' }, bold: true };
      }

      // Write to file with proper error handling
      await workbook.xlsx.writeFile(filePath);
      console.log(`[${requestId}] ✅ Attendance saved to Excel (${filePath})`);
      console.log(`[${requestId}] Columns: ID=${student_id}, Name=${student_name}, Date=${dateStr}, Time=${timeStr}, IP=${clientIp}, Status=${status}`);
    } catch (excelError) {
      console.error(`[${requestId}] Excel write error:`, excelError.message);
      console.error(`[${requestId}] Stack:`, excelError.stack);
      // Don't fail the entire request if Excel fails - data is still in JSON DB
      console.warn(`[${requestId}] ⚠️ Excel save failed, but JSON database was saved`);
    }

    // ========== SAVE TO JSON DATABASE ==========
    try {
      const timestamp = new Date().toISOString();
      db.addAttendance({
        timestamp,
        student_id,
        student_name,
        status,
        clientIp,
        allowedIp: allowedIp || null,
        isPrivate,
        proxy,
        reason,
      });
      console.log(`[${requestId}] Attendance saved to JSON database`);
    } catch (dbError) {
      console.error(`[${requestId}] Database write error:`, dbError.message);
      return res.status(500).json({
        message: 'Server error saving attendance to database.',
        success: false,
      });
    }

    // ========== SUCCESS RESPONSE ==========
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Request completed in ${duration}ms`);

    res.json({
      message:
        status === 'Present'
          ? `Successfully marked Present (IP matched: ${clientIp}).`
          : `Marked Absent (IP ${clientIp} does not match expected IP ${allowedIp || '(none)'}).`,
      success: true,
      status,
      clientIp,
      expectedIp: allowedIp || null,
      isPrivate,
      proxy,
      reason,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] UNHANDLED ERROR (${duration}ms):`, error.message);
    console.error(`[${requestId}] Stack:`, error.stack);

    // Send generic error to client
    res.status(500).json({
      message: 'Internal server error. Please try again later.',
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Returns the client's public IP as seen by the server and some hints
app.get('/api/my-ip', (req, res) => {
  try {
    const clientIp = extractClientIp(req) || '(unknown)';
    const isPrivate = isPrivateIp(clientIp);
    const possibleProxyChain = possibleProxy(req);

    console.log(`[API] GET /api/my-ip - Client IP: ${clientIp}`);

    return res.json({
      success: true,
      clientIp,
      isPrivate,
      possibleProxy: possibleProxyChain,
      note: isPrivate ? 'You are on a private/local network' : 'You are on a public network',
    });
  } catch (err) {
    console.error('[API] Error in /api/my-ip:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Could not determine your IP address',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// Get expected IP for a given student
app.get('/api/expected-ip/:studentId', (req, res) => {
  try {
    const studentId = req.params.studentId;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    const ip = db.getExpectedIp(studentId) || null;
    console.log(`[API] GET /api/expected-ip/${studentId}`);

    res.json({
      success: true,
      studentId,
      expectedIp: ip,
    });
  } catch (err) {
    console.error('[API] Error in /api/expected-ip:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving expected IP',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// Admin: set expected IP for a student
app.post('/api/set-expected-ip', (req, res) => {
  try {
    const token = req.headers['authorization'] || req.query.token || '';

    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      console.warn('[API] Unauthorized attempt to set expected IP');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { student_id, expected_ip } = req.body;

    if (!student_id || !expected_ip) {
      return res.status(400).json({
        success: false,
        message: 'student_id and expected_ip are required',
      });
    }

    db.setExpectedIp(student_id, expected_ip);
    console.log(`[API] POST /api/set-expected-ip - Student: ${student_id}, IP: ${expected_ip}`);

    res.json({
      success: true,
      message: 'Expected IP saved successfully',
      student_id,
      expected_ip,
    });
  } catch (err) {
    console.error('[API] Error in /api/set-expected-ip:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error saving expected IP',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// Download attendance file
app.get('/api/attendance/download', (req, res) => {
  try {
    const token = req.query.token || req.headers['authorization'] || '';

    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      console.warn('[API] Unauthorized download attempt');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const filePath = path.join(__dirname, 'attendance.xlsx');

    if (!fs.existsSync(filePath)) {
      console.warn('[API] Attendance file not found for download');
      return res.status(404).json({
        success: false,
        message: 'No attendance records yet',
      });
    }

    console.log('[API] GET /api/attendance/download - Download started');
    res.download(filePath, 'attendance.xlsx', (err) => {
      if (err) {
        console.error('[API] Download error:', err.message);
      }
    });
  } catch (err) {
    console.error('[API] Error in /api/attendance/download:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error downloading file',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// Protected endpoint for admin UI to fetch attendance records
app.get('/api/attendance/records', async (req, res) => {
  try {
    const token = req.headers['authorization'] || '';

    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      console.warn('[API] Unauthorized access to attendance records');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    console.log('[API] GET /api/attendance/records - Fetching records');

    // Try to read from Excel
    let records = [];
    try {
      const workbook = new ExcelJS.Workbook();
      const filePath = path.join(__dirname, 'attendance.xlsx');

      if (fs.existsSync(filePath)) {
        await workbook.xlsx.readFile(filePath);
        const sheet = workbook.getWorksheet('Attendance') || workbook.worksheets[0];

        if (sheet) {
          sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header

            // Read columns in EXACT order: ID, Name, Date, Time, IP Address, Status
            const values = row.values;
            
            // Extract values from row
            // Excel row.values is 1-indexed, so:
            // values[1] = ID
            // values[2] = Name
            // values[3] = Date
            // values[4] = Time
            // values[5] = IP Address
            // values[6] = Status
            
            const id = values[1] ? String(values[1]).trim() : '';
            const name = values[2] ? String(values[2]).trim() : '';
            const date = values[3] ? String(values[3]).trim() : '';
            const time = values[4] ? String(values[4]).trim() : '';
            const ip = values[5] ? String(values[5]).trim() : '';
            const status = values[6] ? String(values[6]).trim() : '';

            // Only add if we have at least ID and name
            if (id || name) {
              records.push({
                id: id,
                name: name,
                date: date,        // Already in YYYY-MM-DD format from writing
                time: time,        // Already in HH:MM:SS format from writing
                ip: ip,
                status: status
              });
            }
          });
        }
      }
    } catch (excelErr) {
      console.warn('[API] Could not read Excel file, using JSON DB:', excelErr.message);
      // Fallback to JSON DB with proper mapping
      records = db.getAllAttendance().map((record) => {
        // Parse ISO timestamp and format as YYYY-MM-DD and HH:MM:SS
        let date = '';
        let time = '';
        
        try {
          const dateObj = new Date(record.timestamp);
          if (!isNaN(dateObj.getTime())) {
            // Format as YYYY-MM-DD
            date = dateObj.toISOString().split('T')[0];
            // Format as HH:MM:SS
            time = dateObj.toLocaleTimeString('en-US', { 
              hour12: false, 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            });
          }
        } catch (e) {
          console.error('[API] Error parsing timestamp:', record.timestamp);
        }

        return {
          id: record.student_id || '',
          name: record.student_name || '',
          date: date,
          time: time,
          ip: record.clientIp || '',
          status: record.status || ''
        };
      });
    }

    console.log(`[API] Returning ${records.length} attendance records`);
    
    // Return as ARRAY, not wrapped in object
    res.json(records);
  } catch (err) {
    console.error('[API] Error reading records:', err.message);
    console.error('[API] Stack:', err.stack);
    res.status(500).json({
      success: false,
      message: 'Server error fetching records',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// ============================================================================
// GLOBAL ERROR HANDLING
// ============================================================================

/**
 * 404 Handler - for routes that don't exist
 */
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.path} not found`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

/**
 * Global Error Handler Middleware
 * Catches ALL errors thrown in async routes and sync errors
 */
app.use((err, req, res, next) => {
  console.error('\n' + '='.repeat(80));
  console.error('[GLOBAL_ERROR] Unhandled Error');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('='.repeat(80) + '\n');

  // Determine status code
  const statusCode = err.status || err.statusCode || 500;

  // Don't send detailed error messages in production
  const errorResponse = {
    success: false,
    message: statusCode === 500 ? 'Internal server error. Please try again later.' : err.message,
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.error = err.message;
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log(`[SERVER] ✅ Attendance System Server Started`);
  console.log(`[SERVER] URL: http://localhost:${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[SERVER] Allowed IP: ${ALLOWED_IP || '(not set)'}`);
  console.log(`[SERVER] Admin Token: ${ADMIN_TOKEN ? '✓ Set' : '✗ Not Set'}`);
  console.log('='.repeat(80) + '\n');

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('\n' + '!'.repeat(80));
    console.error('[FATAL] Uncaught Exception');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    console.error('!'.repeat(80) + '\n');
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('\n' + '!'.repeat(80));
    console.error('[FATAL] Unhandled Promise Rejection');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    console.error('!'.repeat(80) + '\n');
    process.exit(1);
  });
});
