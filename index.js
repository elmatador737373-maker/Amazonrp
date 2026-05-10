const express = require('express');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const session = require('express-session');
const app = express();

app.use(express.json());

let screenLogs = [];

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify']
}, (accessToken, refreshToken, profile, cb) => cb(null, profile)));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use(session({ 
    secret: 'secret-aizen-key', 
    resave: false, 
    saveUninitialized: false 
}));

app.use(passport.initialize());
app.use(passport.session());

// Home Page
app.get('/', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.send(`
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:white;font-family:sans-serif;margin:0;">
                <a href="/auth/discord" style="color:#5865F2;text-decoration:none;font-size:1.5rem;border:2px solid #5865F2;padding:10px 20px;border-radius:8px;">Login con Discord</a>
            </body>
        `);
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { background: #111; color: white; display: flex; flex-direction: column; 
                       align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; overflow: hidden; }
                h1 { font-size: 12vw; text-align: center; color: #ff4757; margin: 20px; }
                p { color: #555; font-size: 0.9rem; }
            </style>
        </head>
        <body>
            <p>Connesso come: ${req.user.username}</p>
            <h1>AIZEN È UN COGLIONE</h1>
            
            <script>
                function report(reason) {
                    fetch('/report-screen', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason: reason })
                    });
                }

                document.addEventListener('visibilitychange', () => {
                    if (document.hidden) report("Possibile screenshot/uscita");
                });

                window.addEventListener('keyup', (e) => {
                    if (e.key === 'PrintScreen') report("Tasto Stamp premuto");
                });
            </script>
        </body>
        </html>
    `);
});

// Endpoint Segnalazioni
app.post('/report-screen', (req, res) => {
    if (req.isAuthenticated()) {
        screenLogs.push({
            username: req.user.username,
            id: req.user.id,
            data: new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' }),
            motivo: req.body.reason
        });
        res.sendStatus(200);
    } else {
        res.sendStatus(401);
    }
});

// Pannello Admin
app.get('/admin', (req, res) => {
    const MIO_ID_DISCORD = "1191824316376043580"; // <--- METTI IL TUO ID QUI!
    
    if (req.isAuthenticated() && req.user.id === MIO_ID_DISCORD) {
        let rows = screenLogs.map(l => `
            <div style="border-bottom:1px solid #444;padding:10px;margin-bottom:5px;">
                <b style="color:#ff4757;">${l.username}</b> (ID: ${l.id})<br>
                <small style="color:#aaa;">${l.data} - ${l.motivo}</small>
            </div>
        `).join('');
        
        res.send(`
            <body style="background:#222;color:white;font-family:sans-serif;padding:20px;">
                <h2>Log Screenshot / Attività Sospette</h2>
                <div style="background:#333;border-radius:8px;padding:10px;">
                    ${rows || "Nessun log registrato."}
                </div>
                <br><a href="/" style="color:#5865F2;">Torna alla Home</a>
            </body>
        `);
    } else {
        res.status(403).send("Non sei autorizzato.");
    }
});

// Rotte OAuth
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server pronto'));
