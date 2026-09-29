const form = document.getElementById('booking-form');
const dateEl = document.getElementById('data');
const timeEl = document.getElementById('horario');
const msg = document.getElementById('msg');

dateEl.min = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
).toISOString().slice(0, 10);

function show(text, type = '') {
    msg.textContent = text;
    msg.className = `form-message ${type}`.trim();
}

dateEl.addEventListener('change', async () => {
    timeEl.disabled = true;

    if (!dateEl.value) {
        timeEl.innerHTML =
            '<option value="">Selecione uma data primeiro</option>';
        return;
    }

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
            timeEl.innerHTML =
                '<option value="">Sem horários disponíveis, tente outro dia</option>';
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
            dateEl.min = new Date(
                Date.now() - new Date().getTimezoneOffset() * 60000
            ).toISOString().slice(0, 10);
            timeEl.disabled = true;
            timeEl.innerHTML =
                '<option value="">Selecione uma data primeiro</option>';
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
