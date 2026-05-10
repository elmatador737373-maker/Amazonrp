const express = require('express');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const session = require('express-session');
const app = express();

app.use(express.json()); // Necessario per leggere i report inviati dal telefono

let screenLogs = [];

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify']
}, (accessToken, refreshToken, profile, cb) => cb(null, profile)));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Pagina Principale ottimizzata per Mobile
app.get('/', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.send('<body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:white;font-family:sans-serif;"><a href="/auth/discord" style="color:#5865F2;text-decoration:none;font-size:1.5rem;border:2px solid #5865F2;padding:10px 20px;border-radius:8px;">Login con Discord</a></body>');
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { background: #111; color: white; display: flex; flex-direction: column; 
                       align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; overflow: hidden; }
                h1 { font-size: 12vw; text-align: center; color: #ff4757; }
                p { color: #555; font-size: 0.8rem; }
            </style>
        </head>
        <body>
            <p>Utente: ${req.user.username}</p>
            <h1>AIZEN È UN COGLIONE</h1>
            
            <script>
                // Funzione che avvisa il server
                function alertAdmin(reason) {
                    fetch('/report-screen', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason: reason })
                    });
                }

                // Su Mobile: rileva quando la pagina viene "nascosta" (es. anteprima screenshot o cambio app)
                document.addEventListener('visibilitychange', () => {
                    if (document.hidden) {
                        alertAdmin("Possibile screenshot o uscita dall'app");
                    }
                });

                // Rileva se l'utente prova a fare screenshot tramite combinazioni tasti (se collegato a tastiera)
                window.addEventListener('keyup', (e) => {
                    if (e.key === 'PrintScreen') alertAdmin("Tasto PrintScreen");
                });
            </script>
        </body>
        </html>
    `);
});

// Endpoint per ricevere i log
app.post('/report-screen', (req, res) => {
    if (req.isAuthenticated()) {
        const nuovoLog = {
            username: req.user.username,
            id: req.user.id,
            data: new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' }),
            motivo: req.body.reason
        };
        screenLogs.push(nuovoLog);
        res.sendStatus(200);
    } else {
        res.sendStatus(401);
    }
});

// Pannello Admin per te
app.get('/admin', (req, res) => {
    const MIO_ID_DISCORD = "1430962644126535844"; // <--- CAMBIA QUESTO
    
    if (req.isAuthenticated() && req.user.id === MIO_ID_DISCORD) {
        let lista = screenLogs.map(l => `
            <div style="border-bottom:1px solid #444;padding:10px;">
                <b>${l.username}</b> (ID: ${l.id})<br>
                <small style="color:gray;">${l.data} - Motivo: ${l.motivo}</small>
            </div>
        `).join('');
        
        res.send(\`<body style="background:#222;color:white;font-family:sans-serif;padding:20px;">
            <h2>Log Sospetti (Mobile/PC)</h2>
            \${lista || "Nessun colpevole per ora."}
            <br><a href="/" style="color:cyan;">Torna Home</a>
        </body>\`);
    } else {
        res.status(403).send("Accesso negato.");
    }
});

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server online'));
