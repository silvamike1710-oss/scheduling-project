const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const { createHash, createHmac, randomBytes, timingSafeEqual } = require('crypto');
const db = require('./db');
const { sendEmail } = require('./mailer');
const { rateLimit } = require('express-rate-limit');

const app = express();
app.use(express.json());
const ADMIN_COOKIE = 'admin_session';
const ADMIN_SESSION_DURATION = 8 * 60 * 60 * 1000;
const production = process.env.NODE_ENV === 'production';
const SERVICES = ['Limpeza', 'Clareamento', 'Restauração', 'Extração', 'Ortodontia', 'Implante', 'Prótese', 'Endodontia'];
const BOOKING_SLOTS = createBookingSlots();
const BOOKING_SLOT_SET = new Set(BOOKING_SLOTS);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/admin', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
// Keep /public URLs working for both Express and simple static localhost servers.
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 40 // limit each IP to 40 requests per windowMs
}));
const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false
});

function adminCredentialsConfigured() {
    return Boolean(
        process.env.ADMIN_USERNAME &&
        process.env.ADMIN_PASSWORD &&
        process.env.ADMIN_SESSION_SECRET &&
        Buffer.byteLength(process.env.ADMIN_SESSION_SECRET) >= 32
    );
}

function safeCompare(left, right) {
    // Hash both values to a fixed-length buffer before using the timing-safe comparison.
    const leftHash = createHash('sha256').update(left).digest();
    const rightHash = createHash('sha256').update(right).digest();
    return timingSafeEqual(leftHash, rightHash);
}

// The cookie contains a random session ID and signature; the database lets logout revoke it immediately.
function signAdminSession(expiresAt, sessionId) {
    return createHmac('sha256', process.env.ADMIN_SESSION_SECRET)
        .update(`${expiresAt}.${sessionId}`)
        .digest('base64url');
}

function getAdminSessionId(req) {
    if (!adminCredentialsConfigured()) {
        return null;
    }

    const cookie = req.headers.cookie?.match(/(?:^|;\s*)admin_session=([^;]*)/)?.[1];
    const match = cookie?.match(/^(\d{10,})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/);

    if (!match || Number(match[1]) <= Date.now()) {
        return null;
    }

    const expected = signAdminSession(match[1], match[2]);
    if (!safeCompare(match[3], expected)) {
        return null;
    }

    const activeSession = db.prepare(`
        SELECT id
        FROM admin_sessions
        WHERE id = ? AND expires_at = ? AND expires_at > ?
    `).get(match[2], Number(match[1]), Date.now());
    return activeSession?.id || null;
}

function requireAdmin(req, res, next) {
    if (!getAdminSessionId(req)) {
        return res.status(401).json({ error: 'Autenticação necessária' });
    }

    next();
}

app.get('/api/admin/session', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ authenticated: Boolean(getAdminSessionId(req)) });
});

app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
    if (!adminCredentialsConfigured()) {
        console.error('Admin login is unavailable: configure ADMIN_USERNAME, ADMIN_PASSWORD, and a 32-character ADMIN_SESSION_SECRET.');
        return res.status(503).json({ error: 'A autenticação administrativa não está configurada.' });
    }

    const { username, password } = req.body || {};
    if (
        typeof username !== 'string' ||
        typeof password !== 'string' ||
        !safeCompare(username, process.env.ADMIN_USERNAME) ||
        !safeCompare(password, process.env.ADMIN_PASSWORD)
    ) {
        return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    const expiresAt = Date.now() + ADMIN_SESSION_DURATION;
    const sessionId = randomBytes(32).toString('base64url');
    const session = `${expiresAt}.${sessionId}.${signAdminSession(expiresAt, sessionId)}`;
    db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO admin_sessions (id, expires_at) VALUES (?, ?)').run(sessionId, expiresAt);
    res.cookie(ADMIN_COOKIE, session, {
        httpOnly: true,
        secure: production,
        sameSite: 'strict',
        maxAge: ADMIN_SESSION_DURATION,
        path: '/'
    });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
    const sessionId = getAdminSessionId(req);
    if (sessionId) {
        db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(sessionId);
    }

    res.clearCookie(ADMIN_COOKIE, {
        httpOnly: true,
        secure: production,
        sameSite: 'strict',
        path: '/'
    });
    res.json({ ok: true });
});

function createBookingSlots() {
    const out = [];

    for (let h = 9; h < 18; h++) {
        for (const m of ['00', '30']) {
            out.push(`${String(h).padStart(2, '0')}:${m}`);
        }
    }
    return out;
}

function validDate(s) {
    if (!validCalendarDate(s)) {
        return false;
    }

    const d = new Date(`${s}T00:00:00`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Allow today and future dates, except Sundays
    return d >= today && d.getDay() !== 0;
}

function validCalendarDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return false;
    }

    const date = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === s;
}

app.get('/api/admin/bookings', requireAdmin, (req, res) => {
    const { start, end } = req.query;
    if (!validCalendarDate(start) || !validCalendarDate(end)) {
        return res.status(400).json({ error: 'Período inválido.' });
    }

    const startTime = new Date(`${start}T00:00:00Z`).getTime();
    const endTime = new Date(`${end}T00:00:00Z`).getTime();
    const days = (endTime - startTime) / 86400000;
    if (days < 0 || days > 6) {
        return res.status(400).json({ error: 'O período deve conter no máximo sete dias.' });
    }

    const bookings = db.prepare(`
        SELECT id, nome, email, telefone, data, hora, procedimento, observações
        FROM pacientes
        WHERE data BETWEEN ? AND ?
        ORDER BY data, hora
    `).all(start, end);

    res.set('Cache-Control', 'no-store');
    res.json({ bookings });
});

app.get('/api/procedimentos', (req, res) => {
    const { date } = req.query;

    if (!validDate(date)) {
        return res.json({ slots: [] });
    }

    const taken = db.prepare(
        'SELECT hora FROM pacientes WHERE data = ?'
    ).all(date).map(r => r.hora);

    const takenSlots = new Set(taken);
    const slots = BOOKING_SLOTS.filter(slot => !takenSlots.has(slot));
    res.json({ slots });
});

app.post('/api/agendamento', async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {};
    const { nome, email, telefone, data, horario, procedimento, observacoes, website } = body;

    if (website) return res.json({ ok: true }); // honeypot field, if filled, ignore the request

    const problems = [];

    if (typeof nome !== 'string' || nome.trim().length < 2 || nome.length > 100) {
        problems.push('Nome inválido');
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        problems.push('Email inválido');
    }
    if (typeof telefone !== 'string' || !/^\+?\d{10,15}$/.test(telefone)) {
        problems.push('Telefone inválido');
    }
    if (!validDate(data)) problems.push('Data inválida');
    if (typeof horario !== 'string' || !BOOKING_SLOT_SET.has(horario)) {
        problems.push('horário inválido');
    }
    if (typeof procedimento !== 'string' || !SERVICES.includes(procedimento)) {
        problems.push('Procedimento inválido');
    }
    if (observacoes != null && (typeof observacoes !== 'string' || observacoes.length > 500)) {
        problems.push('observações inválidas ou muito longas');
    }

    if (problems.length > 0) return res.json({ ok: false, problems });

    const appointment = { nome: nome.trim(), email, telefone, data, horario, procedimento, observacoes };

    try {
        db.prepare(`
            INSERT INTO pacientes (nome, email, telefone, data, hora, procedimento, "observações")
            VALUES (@nome, @email, @telefone, @data, @horario, @procedimento, @observacoes)
        `).run(appointment);
    } catch (err) {
        if (String(err.code).startsWith('SQLITE_CONSTRAINT')) {
            return res.json({ ok: false, problems: ['Horário não disponível'] });
        }

        console.error('Erro ao salvar agendamento:', err);
        return res.status(500).json({ ok: false, problems: ['Erro interno do servidor'] });
    }

    try {
        await sendEmail(appointment);
    } catch (err) {
        console.error('Erro ao enviar email do agendamento:', err);
        return res.status(500).json({ ok: false, problems: ['Erro ao enviar email'] });
    }

    res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => 
    console.log(`Server running on port ${process.env.PORT || 3000}`));
