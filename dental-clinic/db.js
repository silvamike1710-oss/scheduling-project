const Database = require('better-sqlite3');
const db = new Database('clinic.db');

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

module.exports = db;