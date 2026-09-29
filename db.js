const path = require('path');
const Database = require('better-sqlite3');

// Store the database beside the app so its location does not depend on the launch directory.
const db = new Database(path.join(__dirname, 'clinic.db'));

// Patient records and admin sessions share this local SQLite database.
db.exec(`
    CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL,
        telefone TEXT NOT NULL,
        data TEXT NOT NULL,
        hora TEXT NOT NULL,
        procedimento TEXT NOT NULL,
        observações TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (data, hora)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
        id TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_sessions_expires_at
        ON admin_sessions (expires_at);
`);

module.exports = db;