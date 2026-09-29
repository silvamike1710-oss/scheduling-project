const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// patient input goes inside HTML emails, so neutralize any HTML in it.

const esc = (s = '') => 
    String(s).replace(/[&<>"'`=\/]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#x60;', '=': '&#x3D;', '/': '&#x2F;' }[c]));

async function sendEmail(a) {
    const details = `
    <p><b>Procedimento:</b> ${esc(a.procedimento)}</p>
    <p><b>Data:</b> ${esc(a.data)} às ${esc(a.horario)}</p>
    <p><b>Nome:</b> ${esc(a.nome)}</p>
    <p><b>Email:</b> ${esc(a.email)}</p>
    <p><b>Telefone:</b> ${esc(a.telefone)}</p>
    <p><b>observações:</b> ${esc(a.observacoes) || '-'}</p>`;

//for the clinic

await transporter.sendMail({
    from: `"Clinica Dentaria" <${process.env.SMTP_USER}>`,
    to: process.env.CLINIC_EMAIL,
    replyTo: a.email, //hitting reply will answer patient
    subject: `Novo agendamento de ${esc(a.nome)} para ${esc(a.data)} às ${esc(a.horario)}`,
    html: `<h2>Novo agendamento</h2>${details}`,
});

//para o paciente
await transporter.sendMail({
    from: `"Clinica Dentaria" <${process.env.SMTP_USER}>`,
    to: a.email,
    subject: `Confirmação de agendamento para ${esc(a.data)} às ${esc(a.horario)}`,
    html: `<h2>Confirmação de agendamento</h2>${details}`,
});
}

module.exports = { sendEmail };