const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// Middleware to check if user is authenticated
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// GET create poll form
router.get('/create', checkAuthenticated, (req, res) => {
  res.render('create', { message: '' });
});

// POST create poll
router.post('/create', checkAuthenticated, async (req, res) => {
  try {
    const { question } = req.body;
    let options = req.body.options; // array of strings

    if (!question || !options || options.length < 2) {
      return res.render('create', { message: 'Question and at least 2 options required' });
    }

    options = options.filter(opt => opt.trim() !== '');
    if (options.length < 2) {
      return res.render('create', { message: 'At least 2 non-empty options required' });
    }

    // Insert poll
    const pollResult = await pool.query(
      'INSERT INTO polls (question, creator_id) VALUES ($1, $2) RETURNING id',
      [question, req.user.id]
    );
    const pollId = pollResult.rows[0].id;

    // Insert options
    for (const text of options) {
      await pool.query('INSERT INTO options (poll_id, text) VALUES ($1, $2)', [pollId, text]);
    }

    res.redirect(`/polls/${pollId}`);
  } catch (err) {
    console.error(err);
    res.render('create', { message: 'Error creating poll' });
  }
});

// GET poll page
router.get('/:id', async (req, res) => {
  try {
    const pollResult = await pool.query('SELECT * FROM polls WHERE id = $1', [req.params.id]);
    if (pollResult.rows.length === 0) return res.status(404).send('Poll not found');

    const poll = pollResult.rows[0];
    const optionsResult = await pool.query('SELECT * FROM options WHERE poll_id = $1', [poll.id]);

    let hasVoted = false;
    if (req.isAuthenticated()) {
      const voteResult = await pool.query(
        'SELECT * FROM votes WHERE user_id = $1 AND poll_id = $2',
        [req.user.id, poll.id]
      );
      hasVoted = voteResult.rows.length > 0;
    }

    // Initial vote counts
    const initialCounts = [];
    for (const opt of optionsResult.rows) {
      const countResult = await pool.query('SELECT COUNT(*) as count FROM votes WHERE option_id = $1', [opt.id]);
      initialCounts.push({
        id: opt.id,
        text: opt.text,
        count: parseInt(countResult.rows[0].count)
      });
    }

    res.render('poll', {
      poll,
      options: initialCounts,
      user: req.user,
      hasVoted
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading poll');
  }
});

// POST vote
router.post('/:id/vote', checkAuthenticated, async (req, res) => {
  const pollId = req.params.id;
  const { optionId } = req.body;

  try {
    // Prevent double voting
    const existing = await pool.query(
      'SELECT * FROM votes WHERE user_id = $1 AND poll_id = $2',
      [req.user.id, pollId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You have already voted' });
    }

    // Check option belongs to poll
    const option = await pool.query(
      'SELECT * FROM options WHERE id = $1 AND poll_id = $2',
      [optionId, pollId]
    );
    if (option.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid option' });
    }

    await pool.query(
      'INSERT INTO votes (user_id, option_id, poll_id) VALUES ($1, $2, $3)',
      [req.user.id, optionId, pollId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Vote failed' });
  }
});

// GET live results
router.get('/:id/results', async (req, res) => {
  try {
    const pollId = req.params.id;

    const pollResult = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);
    if (pollResult.rows.length === 0) return res.status(404).json({ error: 'Poll not found' });

    const optionsResult = await pool.query('SELECT * FROM options WHERE poll_id = $1', [pollId]);

    const results = [];
    for (const opt of optionsResult.rows) {
      const countResult = await pool.query('SELECT COUNT(*) as count FROM votes WHERE option_id = $1', [opt.id]);
      results.push({
        id: opt.id,
        text: opt.text,
        count: parseInt(countResult.rows[0].count)
      });
    }

    let userHasVoted = false;
    if (req.isAuthenticated()) {
      const voteResult = await pool.query(
        'SELECT * FROM votes WHERE user_id = $1 AND poll_id = $2',
        [req.user.id, pollId]
      );
      userHasVoted = voteResult.rows.length > 0;
    }

    res.json({
      question: pollResult.rows[0].question,
      results,
      userHasVoted
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get results' });
  }
});

module.exports = router;
