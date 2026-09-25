const express = require('express');
const { db } = require('../db');
const { answerQuestion } = require('../qa');

const router = express.Router();

/**
 * POST /api/chat
 * Ask questions about uploaded documents
 */
router.post('/', async (req, res) => {
  try {
    const { question } = req.body || {};

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Question cannot be empty. Please ask a valid question.' });
    }

    const allDocuments = db.getAll();
    const result = await answerQuestion(question.trim(), allDocuments);

    res.json(result);
  } catch (err) {
    console.error('Chat endpoint error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to process question' });
  }
});

module.exports = router;
