require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const path = require('path');
const { pool, initializeDatabase } = require('./database');
const initializePassport = require('./passportConfig');

const authRoutes = require('./routes/auth');
const pollRoutes = require('./routes/polls');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Passport
initializePassport(passport, pool);

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session storage in PostgreSQL
app.use(session({
  store: new PgSession({
    pool: pool,                // Connection pool
    tableName: 'session'       // Will be created automatically
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Make user available to all templates
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

// Routes
app.use('/', authRoutes);
app.use('/polls', pollRoutes);

// Home page – list all polls
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM polls ORDER BY created_at DESC');
    res.render('index', { polls: result.rows });
  } catch (err) {
    console.error(err);
    res.render('index', { polls: [] });
  }
});

// Start server after DB initialisation
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
