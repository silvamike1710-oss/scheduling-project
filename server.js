require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');
const { sendEmail } = require('./mailer');
const { rateLimit } = require('express-rate-limit');

const app = express();
app.use(express.json());
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 40 // limit each IP to 40 requests per windowMs
}));

// settings for the clinic. edit it for the specified clinic. this is used in the email sent to the patient and the clinic.
const SERVICES = ['Limpeza', 'Clareamento', 'Restauração', 'Extração', 'Ortodontia', 'Implante', 'Prótese', 'Endodontia'];
const OPEN_HOURS = 'Segunda a Sábado, 9h às 18h', CLOSED_HOURS = 'Domingo e feriados';

function allSlots() {
    const out = [];

    for (let h = 9; h < 18; h++) {
        for (const m of ['00', '30']) {
            out.push(`${String(h).padStart(2, '0')}:${m}`);
        }
    }

    return out;
}
console.log('Generated slots:', allSlots());

function validDate(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return false;
    }

    const d = new Date(`${s}T00:00:00`);

    if (isNaN(d.getTime())) {
        return false;
    }

    // Reject invalid calendar dates
    if (d.toISOString().slice(0, 10) !== s) {
        return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Allow today and future dates, except Sundays
    return d >= today && d.getDay() !== 0;
}
app.get('/api/procedimentos', (req, res) => {
    const { date } = req.query;

    if (!validDate(date)) {
        console.log('Invalid date:', date);
        return res.json({ slots: [] });
    }

    const taken = db.prepare(
        'SELECT hora FROM pacientes WHERE data = ?'
    ).all(date).map(r => r.hora);

    const slots = allSlots().filter(t => !taken.includes(t));

    console.log('Selected date:', date);
    console.log('Taken slots:', taken);
    console.log('Available slots:', slots);

    res.json({ slots });
});

app.post('/api/agendamento', async (req, res) => {
    const { nome, email, telefone, data, horario, procedimento, observacoes, website } = req.body;

    if (website) return res.json({ ok: true }); // honeypot field, if filled, ignore the request

const problems = [];

if (!nome || nome.trim().length <2 || nome.length > 100) problems.push('Nome inválido');
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push('Email inválido');
if (!telefone || !/^\+?\d{10,15}$/.test(telefone)) problems.push('Telefone inválido');
if (!validDate(data)) problems.push('Data inválida');
if (!allSlots().includes(horario)) problems.push('horário inválido');
if (!SERVICES.includes(procedimento)) problems.push('Procedimento inválido');
if (observacoes && observacoes.length > 500) problems.push('observações muito longas');

if (problems.length > 0) return res.json({ ok: false, problems });

const appt = { nome, email, telefone, data, horario, procedimento, observacoes };

try {
    db.prepare(`INSERT INTO pacientes (nome, email, telefone, data, hora, procedimento, "observações") VALUES (@nome, @email, @telefone, @data, @horario, @procedimento, @observacoes)`).run(appt);
} catch (err) {
    if (String(err.code).startsWith('SQLITE_CONSTRAINT')) return res.json({ ok: false, problems: ['Horário não disponível'] });
    console.error(err);
    return res.json({ ok: false, problems: ['Erro interno do servidor'] });
}

try {
    await sendEmail(appt);
} catch (err) {
    console.error(err);
    return res.json({ ok: false, problems: ['Erro ao enviar email'] });
}

res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => 
    console.log(`Server running on port ${process.env.PORT || 3000}`));
