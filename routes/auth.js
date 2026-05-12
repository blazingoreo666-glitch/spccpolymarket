const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const passport = require('passport');
const db = require('../database');

// GET signup page
router.get('/signup', (req, res) => {
  res.render('signup', { message: '' });
});

// POST signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
    stmt.run(email, hashedPassword);
    res.redirect('/login');
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.render('signup', { message: 'Email already registered' });
    } else {
      res.render('signup', { message: 'Something went wrong' });
    }
  }
});

// GET login page
router.get('/login', (req, res) => {
  res.render('login', { message: '' });
});

// POST login
router.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: false
}));

// GET logout
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

module.exports = router;
