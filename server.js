require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const path = require('path');

const app = express();

// Configurazione Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Passport Setup
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(session({ secret: 'amazon_rp_secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Middleware per Ruoli e Sincronizzazione Bot
async function syncDiscord(req, res, next) {
    if (!req.isAuthenticated()) return next();
    
    const { data: settings } = await supabase.from('settings').select('*').single();
    if (!settings) return next();

    try {
        const response = await axios.get(`https://discord.com/api/guilds/${settings.guild_id}/members/${req.user.id}`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
        });
        const roles = response.data.roles;
        req.isDirector = roles.includes(settings.director_role_id);
        req.isCourier = roles.includes(settings.courier_role_id);
        req.userRoles = roles;
    } catch (e) { console.error("Errore sync Discord API"); }
    next();
}

// --- ROTTE ---

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/api/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/'));
app.get('/logout', (req, res) => { req.logout(() => res.redirect('/')); });

app.get('/', syncDiscord, async (req, res) => {
    const { data: products } = await supabase.from('products').select('*');
    const { data: settings } = await supabase.from('settings').select('*').single();
    res.render('index', { user: req.user, products: products || [], settings, isDirector: req.isDirector, isCourier: req.isCourier });
});

// Acquisto e Sottrazione UnbelievaBoat
app.post('/api/buy', syncDiscord, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ msg: "Effettua il login" });
    
    const { productId, type } = req.body;
    const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
    const { data: settings } = await supabase.from('settings').select('*').single();
    
    const price = type === 'wholesale' ? product.wholesale_price : product.price;

    try {
        // PATCH a UnbelievaBoat
        await axios.patch(`https://unbelievaboat.com/api/v1/guilds/${settings.guild_id}/users/${req.user.id}`, 
            { cash: -price },
            { headers: { Authorization: process.env.UNBELIEVA_TOKEN } }
        );

        // Invio Webhook Ordine
        await axios.post(settings.webhook_url, {
            embeds: [{
                title: "📦 NUOVO ORDINE AMAZON",
                color: 16753920,
                description: `**Cliente:** <@${req.user.id}>\n**Oggetto:** ${product.name}\n**Tipo:** ${type.toUpperCase()}`,
                footer: { text: "Gestione Amazon RP" }
            }]
        });

        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, message: "Fondi insufficienti su UnbelievaBoat" });
    }
});

// Dashboard: Aggiorna Impostazioni (Solo Direttore)
app.post('/api/admin/settings', syncDiscord, async (req, res) => {
    if (!req.isDirector) return res.status(403).send("Vietato");
    await supabase.from('settings').upsert({ id: 1, ...req.body });
    res.redirect('/');
});

// Dashboard: Aggiungi Prodotto (Solo Direttore)
app.post('/api/admin/add-product', syncDiscord, async (req, res) => {
    if (!req.isDirector) return res.status(403).send("Vietato");
    await supabase.from('products').insert([req.body]);
    res.redirect('/');
});

app.listen(process.env.PORT || 3000, () => console.log("Amazon RP Live on Render"));

