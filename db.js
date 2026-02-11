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
      const initialDb = { users: {}, attendance: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
      return initialDb;
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[DB] Error loading database:', error.message);
    // Return safe default structure
    return { users: {}, attendance: [] };
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

module.exports = {
  addAttendance,
  getAttendanceForStudent,
  setExpectedIp,
  getExpectedIp,
  getAllAttendance,
};
