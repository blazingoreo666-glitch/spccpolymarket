const express = require('express');
const router = express.Router();
const db = require('../database');

// Middleware to check if user is authenticated
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// GET create poll form
router.get('/create', checkAuthenticated, (req, res) => {
  res.render('create', { message: '' });
});

// POST create poll (form fields: question, options[])
router.post('/create', checkAuthenticated, (req, res) => {
  const { question } = req.body;
  let options = req.body.options;   // array of strings

  if (!question || !options || options.length < 2) {
    return res.render('create', { message: 'Question and at least 2 options required' });
  }

  // Filter empty options
  options = options.filter(opt => opt.trim() !== '');
  if (options.length < 2) {
    return res.render('create', { message: 'At least 2 non-empty options required' });
  }

  // Insert poll
  const insertPoll = db.prepare('INSERT INTO polls (question, creator_id) VALUES (?, ?)');
  const pollInfo = insertPoll.run(question, req.user.id);
  const pollId = pollInfo.lastInsertRowid;

  // Insert options
  const insertOption = db.prepare('INSERT INTO options (poll_id, text) VALUES (?, ?)');
  options.forEach(text => insertOption.run(pollId, text));

  res.redirect(`/polls/${pollId}`);
});

// GET poll page (vote form + live results)
router.get('/:id', (req, res) => {
  const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(req.params.id);
  if (!poll) return res.status(404).send('Poll not found');

  const options = db.prepare('SELECT * FROM options WHERE poll_id = ?').all(poll.id);

  // Check if current user already voted
  let hasVoted = false;
  if (req.isAuthenticated()) {
    const vote = db.prepare('SELECT * FROM votes WHERE user_id = ? AND poll_id = ?').get(req.user.id, poll.id);
    hasVoted = !!vote;
  }

  // Initial vote counts (will be updated live by AJAX)
  const initialCounts = options.map(opt => {
    const count = db.prepare('SELECT COUNT(*) as count FROM votes WHERE option_id = ?').get(opt.id).count;
    return { id: opt.id, text: opt.text, count };
  });

  res.render('poll', {
    poll,
    options: initialCounts,
    user: req.user,
    hasVoted
  });
});

// POST vote
router.post('/:id/vote', checkAuthenticated, (req, res) => {
  const pollId = req.params.id;
  const { optionId } = req.body;

  // Prevent double voting
  const existing = db.prepare('SELECT * FROM votes WHERE user_id = ? AND poll_id = ?').get(req.user.id, pollId);
  if (existing) {
    return res.status(400).json({ error: 'You have already voted' });
  }

  // Check option belongs to poll
  const option = db.prepare('SELECT * FROM options WHERE id = ? AND poll_id = ?').get(optionId, pollId);
  if (!option) {
    return res.status(400).json({ error: 'Invalid option' });
  }

  db.prepare('INSERT INTO votes (user_id, option_id, poll_id) VALUES (?, ?, ?)').run(req.user.id, optionId, pollId);
  res.json({ success: true });
});

// GET live results (called by AJAX every few seconds)
router.get('/:id/results', (req, res) => {
  const pollId = req.params.id;
  const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });

  const options = db.prepare('SELECT * FROM options WHERE poll_id = ?').all(pollId);
  const results = options.map(opt => {
    const count = db.prepare('SELECT COUNT(*) as count FROM votes WHERE option_id = ?').get(opt.id).count;
    return { id: opt.id, text: opt.text, count };
  });

  // Also send whether current user has voted
  let userHasVoted = false;
  if (req.isAuthenticated()) {
    const vote = db.prepare('SELECT * FROM votes WHERE user_id = ? AND poll_id = ?').get(req.user.id, pollId);
    userHasVoted = !!vote;
  }

  res.json({ question: poll.question, results, userHasVoted });
});

module.exports = router;
