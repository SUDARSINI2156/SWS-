const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Ensure test environment
process.env.NODE_ENV = 'test';
const app = require('../server');
const { db } = require('../src/db');

describe('Document Management API', () => {
  let createdDocId = null;
  const testDir = path.join(__dirname, 'test_fixtures');

  before(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  after(() => {
    // Clean up test fixtures
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('POST /api/documents (Upload)', () => {
    it('should successfully upload a .txt document and extract text', async () => {
      const txtPath = path.join(testDir, 'sample.txt');
      fs.writeFileSync(txtPath, 'This is a sample document for testing text extraction.');

      const res = await request(app)
        .post('/api/documents')
        .attach('file', txtPath);

      assert.strictEqual(res.status, 201);
      assert.ok(res.body._id, 'Response should contain document _id');
      assert.strictEqual(res.body.originalName, 'sample.txt');
      assert.strictEqual(res.body.text, 'This is a sample document for testing text extraction.');
      assert.ok(res.body.size > 0);
      assert.ok(res.body.createdAt);

      createdDocId = res.body._id;
    });

    it('should successfully upload a .md document', async () => {
      const mdPath = path.join(testDir, 'readme.md');
      fs.writeFileSync(mdPath, '# Markdown Document\n\n- Point 1\n- Point 2');

      const res = await request(app)
        .post('/api/documents')
        .attach('file', mdPath);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.originalName, 'readme.md');
      assert.ok(res.body.text.includes('# Markdown Document'));
    });

    it('should successfully upload a .json document', async () => {
      const jsonPath = path.join(testDir, 'data.json');
      fs.writeFileSync(jsonPath, JSON.stringify({ key: 'value', numbers: [1, 2, 3] }));

      const res = await request(app)
        .post('/api/documents')
        .attach('file', jsonPath);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.originalName, 'data.json');
      assert.ok(res.body.text.includes('"key": "value"'));
    });

    it('should return 400 when no file is uploaded', async () => {
      const res = await request(app).post('/api/documents');
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error);
    });

    it('should return 400 for unsupported file extension', async () => {
      const exePath = path.join(testDir, 'bad_file.exe');
      fs.writeFileSync(exePath, 'binary content');

      const res = await request(app)
        .post('/api/documents')
        .attach('file', exePath);

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error.includes('Unsupported file type'));
    });
  });

  describe('GET /api/documents (List)', () => {
    it('should return all documents sorted newest first', async () => {
      const res = await request(app).get('/api/documents');

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body), 'Response should be an array');
      assert.ok(res.body.length >= 3, 'Should list at least the 3 uploaded documents');

      // Verify newest first
      for (let i = 0; i < res.body.length - 1; i++) {
        const current = new Date(res.body[i].createdAt).getTime();
        const next = new Date(res.body[i + 1].createdAt).getTime();
        assert.ok(current >= next, 'Documents must be sorted in descending order of createdAt');
      }
    });
  });

  describe('GET /api/documents/:id (Get by ID)', () => {
    it('should retrieve document by valid ID', async () => {
      const res = await request(app).get(`/api/documents/${createdDocId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body._id, createdDocId);
      assert.strictEqual(res.body.originalName, 'sample.txt');
    });

    it('should return 404 for non-existent document ID', async () => {
      const res = await request(app).get('/api/documents/non-existent-id-999');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, 'Document not found');
    });
  });

  describe('GET /api/documents/:id/download (Download)', () => {
    it('should allow downloading the uploaded document', async () => {
      const res = await request(app).get(`/api/documents/${createdDocId}/download`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-disposition'].includes('sample.txt'));
      assert.strictEqual(res.text, 'This is a sample document for testing text extraction.');
    });

    it('should return 404 when downloading non-existent document', async () => {
      const res = await request(app).get('/api/documents/non-existent-id-999/download');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, 'Document not found');
    });
  });

  describe('DELETE /api/documents/:id (Delete)', () => {
    it('should successfully delete an existing document', async () => {
      const res = await request(app).delete(`/api/documents/${createdDocId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, createdDocId);

      // Verify it no longer exists in GET
      const getRes = await request(app).get(`/api/documents/${createdDocId}`);
      assert.strictEqual(getRes.status, 404);
    });

    it('should return 404 when deleting a non-existent document', async () => {
      const res = await request(app).delete('/api/documents/non-existent-id-999');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, 'Document not found');
    });
  });
});
