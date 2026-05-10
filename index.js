const express = require('express');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const session = require('express-session');
const app = express();

app.use(express.json());

// Database temporaneo per i log degli screenshot
let screenLogs = [];

// Configurazione Strategia con permessi estesi (identify, email, guilds)
passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'email', 'guilds'] 
}, (accessToken, refreshToken, profile, cb) => {
    return cb(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use(session({ 
    secret: 'aizen_secret_session', 
    resave: false, 
    saveUninitialized: false 
}));

app.use(passport.initialize());
app.use(passport.session());

// --- ROTTE ---

app.get('/', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.send(`
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:white;font-family:sans-serif;margin:0;">
                <div style="text-align:center;">
                    <h2 style="margin-bottom:20px;">Accesso Richiesto</h2>
                    <a href="/auth/discord" style="color:white;background:#5865F2;text-decoration:none;font-size:1.2rem;padding:12px 24px;border-radius:5px;font-weight:bold;">Login con Discord</a>
                </div>
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
                h1 { font-size: 10vw; text-align: center; color: #ff4757; margin: 20px; text-transform: uppercase; }
                .info { color: #aaa; font-size: 0.9rem; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="info">Loggato come: <b>${req.user.username}</b> (${req.user.email})</div>
            <h1>AIZEN È UN COGLIONE</h1>
            
            <script>
                function sendReport(type) {
                    fetch('/report-screen', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason: type })
                    });
                }

                // Rilevamento per Mobile e PC (Cambio tab o minimizzazione)
                document.addEventListener('visibilitychange', () => {
                    if (document.hidden) sendReport("Screenshot o Cambio Pagina");
                });

                // Rilevamento tasto Stamp (PC)
                window.addEventListener('keyup', (e) => {
                    if (e.key === 'PrintScreen') sendReport("Tasto Stamp (PrtScn)");
                });
            </script>
        </body>
        </html>
    `);
});

// Endpoint per ricevere i log degli screenshot
app.post('/report-screen', (req, res) => {
    if (req.isAuthenticated()) {
        screenLogs.push({
            username: req.user.username,
            id: req.user.id,
            email: req.user.email,
            time: new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' }),
            reason: req.body.reason
        });
        res.sendStatus(200);
    } else {
        res.sendStatus(401);
    }
});

// Pannello Admin (Sostituisci l'ID con il tuo)
app.get('/admin', (req, res) => {
    const MIO_ID_DISCORD = "1191824316376043580"; 
    
    if (req.isAuthenticated() && req.user.id === MIO_ID_DISCORD) {
        let rows = screenLogs.map(l => `
            <div style="background:#333;padding:15px;border-radius:8px;margin-bottom:10px;border-left:5px solid #ff4757;">
                <b>Utente:</b> ${l.username} (ID: ${l.id})<br>
                <b>Email:</b> ${l.email}<br>
                <b>Data:</b> ${l.time}<br>
                <b>Evento:</b> <span style="color:#ff4757;">${l.reason}</span>
            </div>
        `).join('');
        
        res.send(\`
            <body style="background:#181818;color:white;font-family:sans-serif;padding:20px;">
                <h2 style="color:#5865F2;">Pannello Controllo Spia</h2>
                <p>Lista utenti che hanno provato a fare screenshot:</p>
                \${rows || "<p>Nessun log presente.</p>"}
                <br><a href="/" style="color:#aaa;text-decoration:none;">← Torna alla Home</a>
            </body>
        \`);
    } else {
        res.status(403).send("Accesso negato. Solo l'admin può vedere questa pagina.");
    }
});

// Rotte OAuth2 - IMPORTANTE: qui specifichiamo gli scopes per Discord
app.get('/auth/discord', passport.authenticate('discord', { scope: ['identify', 'email', 'guilds'] }));

app.get('/auth/discord/callback', passport.authenticate('discord', { 
    failureRedirect: '/' 
}), (req, res) => {
    res.redirect('/');
});

app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Sito online su porta \${PORT}\`));
