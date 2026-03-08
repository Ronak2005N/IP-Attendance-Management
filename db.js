const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

/**
 * Load database from JSON file
 * @returns {Object} Database object with users and attendance arrays
 */
function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      console.log('[DB] db.json not found, creating new database');
      const initialDb = { users: {}, sessions: [], attendance: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
      return initialDb;
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(data);
    // Ensure sessions array exists for backward compatibility
    if (!db.sessions) db.sessions = [];
    return db;
  } catch (error) {
    console.error('[DB] Error loading database:', error.message);
    // Return safe default structure
    return { users: {}, sessions: [], attendance: [] };
  }
}

/**
 * Save database to JSON file
 * @param {Object} data Database object to save
 */
function saveDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[DB] Error saving database:', error.message);
    throw new Error('Failed to save to database');
  }
}

/**
 * Add attendance record to database
 * @param {Object} record Attendance record
 */
function addAttendance(record) {
  try {
    const db = loadDb();
    db.attendance.push(record);
    saveDb(db);
    console.log(`[DB] Attendance recorded for student ${record.student_id}`);
  } catch (error) {
    console.error('[DB] Error adding attendance:', error.message);
    throw error;
  }
}

/**
 * Get all attendance records for a student
 * @param {string} studentId Student ID
 * @returns {Array} Array of attendance records
 */
function getAttendanceForStudent(studentId) {
  try {
    const db = loadDb();
    return db.attendance.filter(record => record.student_id === studentId) || [];
  } catch (error) {
    console.error('[DB] Error retrieving attendance:', error.message);
    return [];
  }
}

/**
 * Set expected IP for a student
 * @param {string} studentId Student ID
 * @param {string} expectedIp Expected IP address
 */
function setExpectedIp(studentId, expectedIp) {
  try {
    const db = loadDb();
    if (!db.users) {
      db.users = {};
    }
    db.users[studentId] = { expectedIp, updatedAt: new Date().toISOString() };
    saveDb(db);
    console.log(`[DB] Expected IP set for student ${studentId}: ${expectedIp}`);
  } catch (error) {
    console.error('[DB] Error setting expected IP:', error.message);
    throw error;
  }
}

/**
 * Get expected IP for a student
 * @param {string} studentId Student ID
 * @returns {string|null} Expected IP or null
 */
function getExpectedIp(studentId) {
  try {
    const db = loadDb();
    if (!db.users || !db.users[studentId]) {
      return null;
    }
    return db.users[studentId].expectedIp || null;
  } catch (error) {
    console.error('[DB] Error getting expected IP:', error.message);
    return null;
  }
}

/**
 * Get all attendance records
 * @returns {Array} All attendance records
 */
function getAllAttendance() {
  try {
    const db = loadDb();
    return db.attendance || [];
  } catch (error) {
    console.error('[DB] Error retrieving all attendance:', error.message);
    return [];
  }
}

// ============================================================================
// SESSION MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Create a new attendance session
 * @param {Object} sessionData Session object { session_id, max_limit, current_count, used_devices, active, start_time }
 */
function createSession(sessionData) {
  try {
    const db = loadDb();
    db.sessions.push(sessionData);
    saveDb(db);
    console.log(`[DB] Session created: ${sessionData.session_id}`);
  } catch (error) {
    console.error('[DB] Error creating session:', error.message);
    throw error;
  }
}

/**
 * Get the currently active session
 * @returns {Object|null} Active session or null
 */
function getActiveSession() {
  try {
    const db = loadDb();
    return db.sessions.find(s => s.active === true) || null;
  } catch (error) {
    console.error('[DB] Error getting active session:', error.message);
    return null;
  }
}

/**
 * End a session (set active = false)
 * @param {string} sessionId Session ID to end. If null, ends the currently active session.
 */
function endSession(sessionId) {
  try {
    const db = loadDb();
    const session = sessionId
      ? db.sessions.find(s => s.session_id === sessionId)
      : db.sessions.find(s => s.active === true);
    if (session) {
      session.active = false;
      session.end_time = new Date().toISOString();
      saveDb(db);
      console.log(`[DB] Session ended: ${session.session_id}`);
    }
    return session || null;
  } catch (error) {
    console.error('[DB] Error ending session:', error.message);
    throw error;
  }
}

/**
 * Add a deviceId to the session's used_devices list and increment current_count
 * @param {string} sessionId Session ID
 * @param {string} deviceId Device ID to add
 */
function addDeviceToSession(sessionId, deviceId) {
  try {
    const db = loadDb();
    const session = db.sessions.find(s => s.session_id === sessionId);
    if (session) {
      session.used_devices.push(deviceId);
      session.current_count += 1;
      saveDb(db);
      console.log(`[DB] Device ${deviceId} added to session ${sessionId} (count: ${session.current_count})`);
    }
  } catch (error) {
    console.error('[DB] Error adding device to session:', error.message);
    throw error;
  }
}

/**
 * Get all sessions (for admin history)
 * @returns {Array} All sessions
 */
function getAllSessions() {
  try {
    const db = loadDb();
    return db.sessions || [];
  } catch (error) {
    console.error('[DB] Error retrieving sessions:', error.message);
    return [];
  }
}

module.exports = {
  addAttendance,
  getAttendanceForStudent,
  setExpectedIp,
  getExpectedIp,
  getAllAttendance,
  createSession,
  getActiveSession,
  endSession,
  addDeviceToSession,
  getAllSessions,
};
