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
 * Searches and ranks documents based on keyword matching and overlap.
 * @param {Array} documents - List of document objects
 * @param {string} question - User question
 * @returns {Array} Scored and ranked documents
 */
function rankDocuments(documents, question) {
  const queryTokens = tokenize(question);
  const rawQuery = question.toLowerCase().trim();

  if (queryTokens.length === 0 && rawQuery.length > 0) {
    // If all words were stopwords, fallback to splitting raw query
    const fallbackTokens = rawQuery.split(/\s+/).filter(Boolean);
    queryTokens.push(...fallbackTokens);
  }

  const scoredDocs = documents.map((doc) => {
    const title = (doc.originalName || '').toLowerCase();
    const content = (doc.text || '').toLowerCase();
    let score = 0;
    const matchedTokens = new Set();

    // Exact phrase match in document content or title gives high bonus
    if (content.includes(rawQuery)) score += 15;
    if (title.includes(rawQuery)) score += 20;

    queryTokens.forEach((token) => {
      // Title match weight
      if (title.includes(token)) {
        score += 8;
        matchedTokens.add(token);
      }

      // Content match
      if (content.includes(token)) {
        matchedTokens.add(token);
        // Count occurrences (capped)
        const regex = new RegExp(`\\b${token}\\b`, 'gi');
        const matches = (content.match(regex) || []).length;
        score += Math.min(matches, 5) * 2;
      }
    });

    // Coverage bonus: ratio of query tokens present
    if (queryTokens.length > 0) {
      const coverage = matchedTokens.size / queryTokens.length;
      score += coverage * 10;
    }

    return {
      doc,
      score,
      matchedTokens: Array.from(matchedTokens)
    };
  });

  // Sort by score descending
  return scoredDocs.sort((a, b) => b.score - a.score);
}

/**
 * Extracts the most relevant sentences or paragraphs from a document for the question.
 */
function extractRelevantSnippets(text, question, maxSentences = 3) {
  if (!text) return '';
  const tokens = tokenize(question);
  // Split into sentences / paragraphs
  const units = text
    .split(/(?<=[.?!])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  if (units.length === 0) return text.slice(0, 300);

  const scoredUnits = units.map((unit) => {
    const lower = unit.toLowerCase();
    let unitScore = 0;
    tokens.forEach((t) => {
      if (lower.includes(t)) unitScore += 1;
    });
    return { unit, score: unitScore };
  });

  scoredUnits.sort((a, b) => b.score - a.score);
  const best = scoredUnits.filter((u) => u.score > 0).slice(0, maxSentences);

  if (best.length === 0) {
    return units.slice(0, maxSentences).join(' ');
  }

  return best.map((b) => b.unit).join(' ');
}

/**
 * Generates an answer using an external LLM if configured, or a local extractive QA fallback.
 */
async function generateAnswer(question, relevantDocs) {
  // If OpenAI API Key is configured
  if (process.env.OPENAI_API_KEY) {
    try {
      const context = relevantDocs
        .map((r) => `Document "${r.doc.originalName}":\n${r.doc.text.slice(0, 3000)}`)
        .join('\n\n---\n\n');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are DocChat, an intelligent AI document assistant. Answer the user question based strictly on the provided documents. If the answer cannot be determined from the documents, say so clearly.'
            },
            {
              role: 'user',
              content: `Documents Context:\n${context}\n\nQuestion: ${question}`
            }
          ],
          temperature: 0.2
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content.trim();
      }
    } catch (err) {
      console.warn('OpenAI API request failed, falling back to local extractor:', err.message);
    }
  }

  // Local extractive fallback QA
  const top = relevantDocs[0];
  const primaryDoc = top.doc;
  const snippet = extractRelevantSnippets(primaryDoc.text, question, 3);

  if (!snippet || snippet.trim().length === 0) {
    return `Based on "${primaryDoc.originalName}", no specific text matching "${question}" was extracted, but the document is stored and available.`;
  }

  const cleanSnippet = snippet.replace(/\s+/g, ' ').trim();
  return `Based on ${primaryDoc.originalName}:\n\n"${cleanSnippet}"`;
}

/**
 * Main Question Answering handler
 */
async function answerQuestion(question, allDocuments) {
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

  const ranked = rankDocuments(allDocuments, question);
  const relevant = ranked.filter((r) => r.score > 0).slice(0, 3);

  if (relevant.length === 0) {
    return {
      answer: "I couldn't find any relevant information in your uploaded documents. Try uploading more documents or rephrasing your question.",
      sources: []
    };
  }

  const sources = relevant.map((r) => ({
    _id: r.doc._id,
    originalName: r.doc.originalName
  }));

  const answer = await generateAnswer(question, relevant);

  return {
    answer,
    sources
  };
}

module.exports = {
  rankDocuments,
  extractRelevantSnippets,
  answerQuestion
};
