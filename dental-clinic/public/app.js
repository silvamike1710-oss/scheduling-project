
const form = document.getElementById('booking-form');
const dateEl = document.getElementById('data');
const timeEl = document.getElementById('horario');
const msg = document.getElementById('msg');

// Block past dates
dateEl.min = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
).toISOString().slice(0, 10);

function show(text, type) {
    msg.textContent = text;
    msg.className = type;
}

// Load available appointment times when the date changes
dateEl.addEventListener('change', async () => {
    timeEl.disabled = true;
    timeEl.innerHTML = '<option value="">Carregando...</option>';

    if (!dateEl.value) {
        timeEl.innerHTML =
            '<option value="">Selecione uma data primeiro</option>';
        return;
    }

    try {
        const res = await fetch(
            `/api/procedimentos?date=${encodeURIComponent(dateEl.value)}`
        );

        if (!res.ok) {
            throw new Error(`HTTP error: ${res.status}`);
        }

        const { slots } = await res.json();

        if (!slots.length) {
            timeEl.innerHTML =
                '<option value="">Sem horários disponíveis, tente outro dia</option>';
            return;
        }

        timeEl.innerHTML =
            '<option value="">Selecione um horário</option>' +
            slots.map(t => `<option value="${t}">${t}</option>`).join('');

        timeEl.disabled = false;

    } catch (error) {
        console.error('Erro ao carregar horários:', error);
        timeEl.innerHTML =
            '<option value="">Erro ao carregar horários</option>';
    }
});

// Submit appointment
form.addEventListener('submit', async e => {
    e.preventDefault();

    const btn = form.querySelector('button');
    btn.disabled = true;
    show('Enviando...', '');

    const data = Object.fromEntries(new FormData(form));

    try {
        const res = await fetch('/api/agendamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (res.ok && result.ok) {
            show('Agendamento realizado com sucesso!', 'ok');
            form.reset();

            timeEl.disabled = true;
            timeEl.innerHTML =
                '<option value="">Selecione uma data primeiro</option>';
        } else {
            show(
                result.problems?.join(', ') ||
                'Erro ao enviar agendamento',
                'err'
            );

            if (res.status === 409) {
                dateEl.dispatchEvent(new Event('change'));
            }
        }

    } catch (error) {
        console.error('Erro ao enviar agendamento:', error);
        show('Erro ao enviar agendamento', 'err');
    } finally {
        btn.disabled = false;
    }
});
