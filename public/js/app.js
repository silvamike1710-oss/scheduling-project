const form = document.getElementById('booking-form');
const dateEl = document.getElementById('data');
const timeEl = document.getElementById('horario');
const msg = document.getElementById('msg');

function setMinimumBookingDate() {
    const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    dateEl.min = localToday.toISOString().slice(0, 10);
}

function resetTimeOptions(message = 'Selecione uma data primeiro') {
    timeEl.disabled = true;
    timeEl.innerHTML = `<option value="">${message}</option>`;
}

setMinimumBookingDate();

function show(text, type = '') {
    msg.textContent = text;
    msg.className = `form-message ${type}`.trim();
}

dateEl.addEventListener('change', async () => {
    if (!dateEl.value) {
        resetTimeOptions();
        return;
    }

    timeEl.disabled = true;
    timeEl.innerHTML = '<option value="">Carregando...</option>';

    try {
        const response = await fetch(
            `/api/procedimentos?date=${encodeURIComponent(dateEl.value)}`
        );

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const { slots } = await response.json();

        if (!slots.length) {
            resetTimeOptions('Sem horários disponíveis, tente outro dia');
            return;
        }

        timeEl.innerHTML =
            '<option value="">Selecione um horário</option>' +
            slots.map(slot => `<option value="${slot}">${slot}</option>`).join('');
        timeEl.disabled = false;
    } catch (error) {
        console.error('Erro ao carregar horários:', error);
        timeEl.innerHTML =
            '<option value="">Erro ao carregar horários</option>';
        show('Não foi possível carregar os horários. Tente novamente.', 'err');
    }
});

form.addEventListener('submit', async event => {
    event.preventDefault();

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    show('Enviando...');

    const data = Object.fromEntries(new FormData(form));

    try {
        const response = await fetch('/api/agendamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (response.ok && result.ok) {
            show('Agendamento realizado com sucesso!', 'ok');
            form.reset();
            setMinimumBookingDate();
            resetTimeOptions();
            return;
        }

        show(
            result.problems?.join(', ') || 'Erro ao enviar agendamento',
            'err'
        );
    } catch (error) {
        console.error('Erro ao enviar agendamento:', error);
        show('Não foi possível enviar o agendamento. Tente novamente.', 'err');
    } finally {
        button.disabled = false;
    }
});
``