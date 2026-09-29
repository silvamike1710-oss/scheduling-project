const loginPanel = document.getElementById('login-panel');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const scheduleMessage = document.getElementById('schedule-message');
const weekDays = document.getElementById('week-days');
const appointmentList = document.getElementById('appointment-list');
const weekSummary = document.getElementById('week-summary');
const weekLabel = document.getElementById('week-label');
const selectedDayLabel = document.getElementById('selected-day-label');
const dayCount = document.getElementById('day-count');
const weekRangeFormatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const selectedDayFormatter = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
});

let weekStart = startOfWeek(new Date());
let selectedDate = dateString(new Date());
let bookings = [];
let bookingsByDate = new Map();

function dateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function startOfWeek(date) {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return monday;
}

function addDays(date, count) {
    const result = new Date(date);
    result.setDate(result.getDate() + count);
    return result;
}

function localDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function groupBookingsByDate(items) {
    return items.reduce((groups, booking) => {
        const dayBookings = groups.get(booking.data) || [];
        dayBookings.push(booking);
        groups.set(booking.data, dayBookings);
        return groups;
    }, new Map());
}

function setMessage(element, text, type = '') {
    element.textContent = text;
    element.className = `form-message ${type}`.trim();
}

function showDashboard() {
    loginPanel.hidden = true;
    dashboard.hidden = false;
    loadBookings();
}

function showLogin(message = '') {
    dashboard.hidden = true;
    loginPanel.hidden = false;
    setMessage(loginMessage, message, message ? 'err' : '');
}

async function checkSession() {
    try {
        const response = await fetch('/api/admin/session');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const { authenticated } = await response.json();
        if (authenticated) {
            showDashboard();
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        showLogin('Para acessar a agenda, inicie o servidor da clínica com “npm start” e abra esta página pelo endereço localhost do servidor.');
    }
}

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    setMessage(loginMessage, 'Verificando acesso...');

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(loginForm)))
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Não foi possível entrar.');
        }

        loginForm.reset();
        showDashboard();
    } catch (error) {
        setMessage(loginMessage, error.message || 'Não foi possível entrar. Tente novamente.', 'err');
    } finally {
        button.disabled = false;
    }
});

document.getElementById('logout-button').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/admin/logout', { method: 'POST' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        showLogin('Você saiu da área administrativa.');
    } catch (error) {
        console.error('Erro ao sair da área administrativa:', error);
        setMessage(scheduleMessage, 'Não foi possível encerrar a sessão. Tente novamente.', 'err');
    }
});

document.getElementById('previous-week').addEventListener('click', () => {
    weekStart = addDays(weekStart, -7);
    selectedDate = dateString(weekStart);
    loadBookings();
});

document.getElementById('next-week').addEventListener('click', () => {
    weekStart = addDays(weekStart, 7);
    selectedDate = dateString(weekStart);
    loadBookings();
});

document.getElementById('current-week').addEventListener('click', () => {
    weekStart = startOfWeek(new Date());
    selectedDate = dateString(new Date());
    loadBookings();
});

function makeElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function renderWeek() {
    const weekEnd = addDays(weekStart, 6);
    weekLabel.textContent = `${weekRangeFormatter.format(weekStart)} – ${weekRangeFormatter.format(weekEnd)}`;

    weekDays.replaceChildren();
    for (let offset = 0; offset < 7; offset += 1) {
        const date = addDays(weekStart, offset);
        const key = dateString(date);
        const count = bookingsByDate.get(key)?.length || 0;
        const button = makeElement('button', 'week-day');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(key === selectedDate));
        if (key === dateString(new Date())) button.classList.add('is-today');

        button.append(
            makeElement('span', 'week-day-name', weekdayFormatter.format(date)),
            makeElement('span', 'week-day-number', String(date.getDate())),
            makeElement('span', 'week-day-count', `${count} ${count === 1 ? 'consulta' : 'consultas'}`)
        );
        button.addEventListener('click', () => {
            selectedDate = key;
            renderWeek();
            renderAppointments();
        });
        weekDays.append(button);
    }

    const total = bookings.length;
    weekSummary.textContent = `${total} ${total === 1 ? 'consulta nesta semana' : 'consultas nesta semana'}`;
}

function renderAppointments() {
    const dateBookings = bookingsByDate.get(selectedDate) || [];
    const date = localDate(selectedDate);
    selectedDayLabel.textContent = selectedDayFormatter.format(date);
    dayCount.textContent = `${dateBookings.length} ${dateBookings.length === 1 ? 'consulta' : 'consultas'}`;
    appointmentList.replaceChildren();

    if (dateBookings.length === 0) {
        const empty = makeElement('div', 'empty-agenda');
        empty.append(
            makeElement('span', 'empty-agenda-icon', '✓'),
            makeElement('strong', '', 'Agenda livre'),
            makeElement('span', '', 'Nenhuma consulta agendada para este dia.')
        );
        appointmentList.append(empty);
        return;
    }

    for (const booking of dateBookings) {
        const card = makeElement('article', 'appointment-card');
        const time = makeElement('time', 'appointment-time', booking.hora);
        time.dateTime = `${booking.data}T${booking.hora}`;
        const details = makeElement('div', 'appointment-details');
        details.append(
            makeElement('h4', '', booking.nome),
            makeElement('p', 'appointment-procedure', booking.procedimento)
        );

        const contacts = makeElement('div', 'appointment-contacts');
        const email = makeElement('a', '', booking.email);
        email.href = `mailto:${booking.email}`;
        const phone = makeElement('a', '', booking.telefone);
        phone.href = `tel:${booking.telefone}`;
        contacts.append(email, phone);
        details.append(contacts);

        if (booking.observações) {
            details.append(makeElement('p', 'appointment-notes', booking.observações));
        }

        card.append(time, details);
        appointmentList.append(card);
    }
}

async function loadBookings() {
    const weekEnd = addDays(weekStart, 6);
    setMessage(scheduleMessage, 'Carregando agenda...');
    appointmentList.replaceChildren();

    try {
        const query = new URLSearchParams({
            start: dateString(weekStart),
            end: dateString(weekEnd)
        });
        const response = await fetch(`/api/admin/bookings?${query}`);
        const result = await response.json();

        if (response.status === 401) {
            showLogin('Sua sessão expirou. Entre novamente.');
            return;
        }
        if (!response.ok) {
            throw new Error(result.error || 'Não foi possível carregar a agenda.');
        }

        bookings = result.bookings;
        bookingsByDate = groupBookingsByDate(bookings);
        setMessage(scheduleMessage, '');
        renderWeek();
        renderAppointments();
    } catch (error) {
        console.error('Erro ao carregar agenda:', error);
        setMessage(scheduleMessage, error.message || 'Não foi possível carregar a agenda.', 'err');
    }
}

checkSession();
