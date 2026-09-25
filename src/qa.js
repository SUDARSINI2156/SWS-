const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing',
  'don\'t', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t',
  'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers',
  'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in',
  'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my',
  'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
  'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d',
  'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s',
  'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves',
  'tell', 'give', 'show', 'explain', 'describe', 'find', 'please'
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Splits text into overlapping chunks for granular passage retrieval.
 */
function chunkDocument(doc, chunkSize = 600, overlap = 100) {
  const text = doc.text || '';
  if (!text.trim()) return [];

  // Split into paragraphs first
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    if (para.length <= chunkSize) {
      chunks.push({
        docId: doc._id,
        originalName: doc.originalName,
        text: para
      });
    } else {
      // Break large paragraph into chunk slices
      let start = 0;
      while (start < para.length) {
        const slice = para.slice(start, start + chunkSize);
        chunks.push({
          docId: doc._id,
          originalName: doc.originalName,
          text: slice
        });
        start += chunkSize - overlap;
      }
    }
  }

  // Fallback if no paragraphs split
  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push({
      docId: doc._id,
      originalName: doc.originalName,
      text: text.slice(0, chunkSize)
    });
  }

  return chunks;
}

/**
 * Searches and ranks document chunks based on BM25-style keyword overlap.
 */
function rankChunks(allDocuments, question) {
  const queryTokens = tokenize(question);
  const rawQuery = question.toLowerCase().trim();

  const allChunks = [];
  allDocuments.forEach((doc) => {
    const docChunks = chunkDocument(doc);
    allChunks.push(...docChunks);
  });

  const scoredChunks = allChunks.map((chunk) => {
    const title = (chunk.originalName || '').toLowerCase();
    const content = (chunk.text || '').toLowerCase();
    let score = 0;
    const matchedTokens = new Set();

    if (content.includes(rawQuery)) score += 20;
    if (title.includes(rawQuery)) score += 15;

    queryTokens.forEach((token) => {
      if (title.includes(token)) {
        score += 8;
        matchedTokens.add(token);
      }
      if (content.includes(token)) {
        matchedTokens.add(token);
        const matches = (content.match(new RegExp(`\\b${token}\\b`, 'gi')) || []).length;
        score += Math.min(matches, 5) * 3;
      }
    });

    if (queryTokens.length > 0) {
      const coverage = matchedTokens.size / queryTokens.length;
      score += coverage * 15;
    }

    return {
      chunk,
      score,
      matchedTokens: Array.from(matchedTokens)
    };
  });

  return scoredChunks.sort((a, b) => b.score - a.score);
}

/**
 * Generate AI Answer using Google Gemini API
 */
async function callGeminiAPI(apiKey, model, question, context, history = []) {
  const chosenModel = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModel}:generateContent?key=${apiKey}`;

  const systemInstruction = `You are DocChat, an intelligent, professional AI document assistant.
Your goal is to answer the user's question accurately and helpfully based strictly on the provided Document Context.
If the answer cannot be determined from the documents, clearly explain that the information is not present in the uploaded files.
Always format your response with clean Markdown (use bullet points, bold headers, and concise summaries where applicable).
Do not hallucinate facts outside the provided documents.`;

  const contents = [];

  // Add previous conversational context if provided
  if (Array.isArray(history) && history.length > 0) {
    history.slice(-6).forEach((h) => {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      });
    });
  }

  const promptText = `DOCUMENT CONTEXT:
${context}

USER QUESTION:
${question}

Please answer based on the context above.`;

  contents.push({
    role: 'user',
    parts: [{ text: promptText }]
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1200
      }
    })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Gemini API error (${res.status})`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response text returned by Gemini API');
  return text.trim();
}

/**
 * Generate AI Answer using OpenAI API
 */
async function callOpenAIAPI(apiKey, model, question, context, history = []) {
  const chosenModel = model || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const messages = [
    {
      role: 'system',
      content:
        'You are DocChat, an intelligent AI document assistant. Answer the user question based strictly on the provided documents. Format with clean Markdown and cite the document names.'
    }
  ];

  if (Array.isArray(history) && history.length > 0) {
    history.slice(-6).forEach((h) => {
      messages.push({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content
      });
    });
  }

  messages.push({
    role: 'user',
    content: `DOCUMENT CONTEXT:\n${context}\n\nQUESTION: ${question}`
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: chosenModel,
      messages,
      temperature: 0.2
    })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `OpenAI API error (${res.status})`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No response text returned by OpenAI API');
  return text.trim();
}

/**
 * Local extractive QA synthesizer when no API key is provided
 */
function localSynthesize(question, topChunks) {
  const primary = topChunks[0];
  const matchedDocs = [...new Set(topChunks.map((c) => c.chunk.originalName))];

  const passages = topChunks
    .slice(0, 3)
    .map((c) => `• [${c.chunk.originalName}]: "${c.chunk.text.trim()}"`)
    .join('\n\n');

  return `Based on ${matchedDocs.join(', ')}:\n\n${passages}\n\n*(Note: Running in local engine mode. Add your Gemini or OpenAI API key in Settings to enable generative LLM synthesis.)*`;
}

/**
 * Validates an API key by calling the provider's models list or lightweight query
 */
async function validateApiKey(provider, apiKey, model) {
  if (provider === 'gemini') {
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(testUrl);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error?.message || 'Invalid Gemini API key');
    }
    return { valid: true, provider: 'gemini' };
  } else if (provider === 'openai') {
    const testUrl = 'https://api.openai.com/v1/models';
    const res = await fetch(testUrl, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error?.message || 'Invalid OpenAI API key');
    }
    return { valid: true, provider: 'openai' };
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Main Question Answering handler
 */
async function answerQuestion(question, allDocuments, options = {}) {
  if (!question || typeof question !== 'string' || !question.trim()) {
    const error = new Error('Question cannot be empty');
    error.statusCode = 400;
    throw error;
  }

  if (!allDocuments || allDocuments.length === 0) {
    return {
      answer: "No documents have been uploaded yet. Please upload documents first so I can assist you with them.",
      sources: []
    };
  }

  // Rank relevant passages across documents
  const ranked = rankChunks(allDocuments, question);
  const relevant = ranked.filter((r) => r.score > 0).slice(0, 4);

  if (relevant.length === 0) {
    return {
      answer: "I couldn't find any relevant information in your uploaded documents. Try uploading more documents or rephrasing your question.",
      sources: []
    };
  }

  // Deduplicate sources
  const seenDocs = new Set();
  const sources = [];
  relevant.forEach((r) => {
    if (!seenDocs.has(r.chunk.docId)) {
      seenDocs.add(r.chunk.docId);
      sources.push({
        _id: r.chunk.docId,
        originalName: r.chunk.originalName
      });
    }
  });

  // Construct context block
  const context = relevant
    .map(
      (r, idx) =>
        `[Document ${idx + 1}: ${r.chunk.originalName}]\n${r.chunk.text}`
    )
    .join('\n\n---\n\n');

  // Determine API key & provider
  const apiKey =
    options.apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY;

  const provider =
    options.provider ||
    (options.apiKey && options.provider) ||
    (process.env.GEMINI_API_KEY ? 'gemini' : null) ||
    (process.env.OPENAI_API_KEY ? 'openai' : null);

  let answer = '';

  if (apiKey && provider === 'gemini') {
    try {
      answer = await callGeminiAPI(
        apiKey,
        options.model || 'gemini-1.5-flash',
        question,
        context,
        options.history
      );
    } catch (apiErr) {
      console.warn('Gemini API call failed, using local fallback:', apiErr.message);
      answer = localSynthesize(question, relevant) + `\n\n*(Gemini API Warning: ${apiErr.message})*`;
    }
  } else if (apiKey && provider === 'openai') {
    try {
      answer = await callOpenAIAPI(
        apiKey,
        options.model || 'gpt-4o-mini',
        question,
        context,
        options.history
      );
    } catch (apiErr) {
      console.warn('OpenAI API call failed, using local fallback:', apiErr.message);
      answer = localSynthesize(question, relevant) + `\n\n*(OpenAI API Warning: ${apiErr.message})*`;
    }
  } else {
    // Local extractive synthesizer
    answer = localSynthesize(question, relevant);
  }

  return {
    answer,
    sources
  };
}

module.exports = {
  tokenize,
  chunkDocument,
  rankChunks,
  answerQuestion,
  validateApiKey
};
