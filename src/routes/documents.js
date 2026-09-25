const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { extractText } = require('../extractor');

const router = express.Router();

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

// File validation filter
const ALLOWED_EXTENSIONS = ['.txt', '.text', '.md', '.markdown', '.json', '.pdf', '.docx', '.doc'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ALLOWED_EXTENSIONS.includes(ext) || (file.mimetype && file.mimetype.startsWith('text/'))) {
    cb(null, true);
  } else {
    req.fileValidationError = `Unsupported file type: ${ext || file.mimetype}. Supported formats: .txt, .md, .json, .pdf, .docx`;
    cb(null, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  },
  fileFilter
});

/**
 * GET /api/documents
 * List all documents sorted newest first
 */
router.get('/', (req, res) => {
  try {
    const documents = db.getAll();
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve documents: ' + err.message });
  }
});

/**
 * GET /api/documents/:id
 * Retrieve a specific document by ID
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const doc = db.getById(id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json(doc);
});

/**
 * GET /api/documents/:id/download
 * Download a document's original file
 */
router.get('/:id/download', (req, res) => {
  const { id } = req.params;
  const doc = db.getById(id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  if (!fs.existsSync(doc.filePath)) {
    return res.status(404).json({ error: 'Document file missing on disk' });
  }

  res.download(doc.filePath, doc.originalName);
});

/**
 * POST /api/documents
 * Upload and parse a new document
 */
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File exceeds the maximum limit of 10 MB' });
      }
      return res.status(err.statusCode || 400).json({ error: err.message });
    }

    if (req.fileValidationError) {
      return res.status(400).json({ error: req.fileValidationError });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please provide a file.' });
    }

    try {
      const { originalname, mimetype, size, path: filePath, filename } = req.file;

      // Extract text content
      const extractedText = await extractText(filePath, originalname, mimetype);

      // Persist document metadata
      const newDoc = {
        _id: uuidv4(),
        originalName: originalname,
        storedName: filename,
        mimetype: mimetype || 'application/octet-stream',
        size,
        createdAt: new Date().toISOString(),
        filePath,
        text: extractedText
      };

      db.insert(newDoc);

      res.status(201).json(newDoc);
    } catch (extractErr) {
      // Clean up uploaded file if processing fails
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      res.status(500).json({ error: 'Failed to process and store document: ' + extractErr.message });
    }
  });
});

/**
 * DELETE /api/documents/:id
 * Delete document metadata and stored file
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const doc = db.getById(id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Delete physical file from disk
  if (doc.filePath && fs.existsSync(doc.filePath)) {
    try {
      fs.unlinkSync(doc.filePath);
    } catch (unlinkErr) {
      console.warn('Failed to delete file from disk:', unlinkErr.message);
    }
  }

  // Remove metadata
  db.delete(id);

  res.json({
    message: 'Document deleted successfully',
    id
  });
});

module.exports = router;
