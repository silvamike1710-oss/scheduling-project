# Dental Clinic

A small Express and SQLite app for patient booking and the clinic's admin schedule.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`. Set the admin credentials and session secret, and configure SMTP sender credentials plus the clinic notification email.
3. Start the server with `npm start`.
4. Open `http://localhost:3000` and use **Administração** in the top navigation to open the schedule.

The session secret must contain at least 32 characters. Generate one with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Do not commit `.env`. The admin schedule and its API require the Express server; opening the HTML through a static file server does not provide authentication or booking data.

## Project layout

- `server.js` contains the booking and admin API routes, input validation, and session checks.
- `db.js` creates the SQLite tables in `clinic.db` beside the app.
- `public/admin.html` and `public/js/admin.js` render the authenticated weekly schedule.
- `public/css/style.css` contains the clinic and admin page styles.
- `mailer.js` sends booking notifications using the SMTP settings in `.env`.
