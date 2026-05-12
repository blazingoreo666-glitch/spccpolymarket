require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');
const path = require('path');
const db = require('./database');
const initializePassport = require('./passportConfig');

const authRoutes = require('./routes/auth');
const pollRoutes = require('./routes/polls');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Passport
initializePassport(passport);

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session storage in SQLite
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: __dirname }),
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
app.get('/', (req, res) => {
  const polls = db.prepare('SELECT * FROM polls ORDER BY created_at DESC').all();
  res.render('index', { polls });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
