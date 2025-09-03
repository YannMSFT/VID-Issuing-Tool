const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const credentialsRoutes = require('./routes/credentials');
const usersRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware configuration
app.use(cors({
    origin: process.env.BASE_URL || `http://localhost:${PORT}`,
    credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'default-secret-vid-issuing-tool',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true only in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 heures
        sameSite: 'lax' // Important for authentication cookies
    }
}));

// Debug middleware for sessions
app.use((req, res, next) => {
    if (req.path.includes('/auth/') || req.path.includes('/api/')) {
        console.log(`🔍 ${req.method} ${req.path} - Session ID: ${req.sessionID}`);
        if (req.session && req.session.user) {
            console.log(`👤 User in session: ${req.session.user.name || 'Unknown'}`);
        } else {
            console.log(`❌ No user in session`);
        }
    }
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/auth', authRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'An internal server error occurred',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Server startup
app.listen(PORT, () => {
    console.log(`🚀 Server started on http://localhost:${PORT}`);
    console.log(`📋 Administration interface available at http://localhost:${PORT}`);
});

module.exports = app;
