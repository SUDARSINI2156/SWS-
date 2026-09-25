const express = require('express');
const { db } = require('../db');
const { answerQuestion, validateApiKey } = require('../qa');

const router = express.Router();

/**
 * POST /api/chat
 * Ask questions about uploaded documents with optional live LLM key
 */
router.post('/', async (req, res) => {
  try {
    const { question, apiKey, provider, model, history } = req.body || {};

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Question cannot be empty. Please ask a valid question.' });
    }

    // Header fallbacks for API Key
    const key = apiKey || req.headers['x-gemini-key'] || req.headers['x-openai-key'];
    const prov =
      provider ||
      (req.headers['x-gemini-key'] ? 'gemini' : req.headers['x-openai-key'] ? 'openai' : null);

    const allDocuments = db.getAll();
    const result = await answerQuestion(question.trim(), allDocuments, {
      apiKey: key,
      provider: prov,
      model,
      history
    });

    res.json(result);
  } catch (err) {
    console.error('Chat endpoint error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to process question' });
  }
});

/**
 * POST /api/chat/validate-key
 * Validate user-provided API key for Gemini or OpenAI
 */
router.post('/validate-key', async (req, res) => {
  try {
    const { provider, apiKey, model } = req.body || {};
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and apiKey are required' });
    }

    const result = await validateApiKey(provider, apiKey, model);
    res.json({ success: true, message: `${provider.toUpperCase()} API key is valid and connected!`, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
