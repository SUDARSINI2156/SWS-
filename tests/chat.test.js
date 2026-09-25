const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
const app = require('../server');
const { db } = require('../src/db');

describe('AI Chat & Question Answering API', () => {
  const testDir = path.join(__dirname, 'test_chat_fixtures');
  let policyDocId = null;

  before(async () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Upload a test document about leave policy
    const policyPath = path.join(testDir, 'company-leave-policy.txt');
    fs.writeFileSync(
      policyPath,
      'Employees are entitled to 25 days of paid annual leave. In addition, employees receive 10 days of paid medical leave. Remote work is permitted on Mondays and Fridays.'
    );

    const res = await request(app)
      .post('/api/documents')
      .attach('file', policyPath);

    policyDocId = res.body._id;
  });

  after(() => {
    // Delete the test document
    if (policyDocId) {
      db.delete(policyDocId);
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('POST /api/chat', () => {
    it('should reject empty question with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ question: '' });

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error);
      assert.ok(res.body.error.toLowerCase().includes('empty'));
    });

    it('should reject whitespace-only question with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ question: '    ' });

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error);
    });

    it('should reject missing question field with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({});

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error);
    });

    it('should answer question and return relevant sources', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ question: 'How many days of paid annual leave are employees entitled to?' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.answer, 'Should contain answer');
      assert.ok(Array.isArray(res.body.sources), 'Should contain sources array');
      assert.ok(res.body.sources.length > 0, 'Sources array should not be empty');

      const sourceDoc = res.body.sources[0];
      assert.ok(sourceDoc._id);
      assert.strictEqual(sourceDoc.originalName, 'company-leave-policy.txt');
      assert.ok(res.body.answer.includes('25 days'));
    });

    it('should return answers for remote work questions', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ question: 'When is remote work permitted?' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.answer.includes('Mondays and Fridays'));
      assert.strictEqual(res.body.sources[0].originalName, 'company-leave-policy.txt');
    });

    it('should gracefully handle questions with no matching keywords', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ question: 'quantum astrophysics black hole radiation formula' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.answer);
      assert.strictEqual(res.body.sources.length, 0);
    });

    it('should validate API key requirements in /api/chat/validate-key', async () => {
      const res = await request(app)
        .post('/api/chat/validate-key')
        .send({});

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error);
    });
  });

  describe('OpenAPI Documentation Endpoint', () => {
    it('GET /api-docs.json should serve valid OpenAPI 3.0 specification', async () => {
      const res = await request(app).get('/api-docs.json');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.openapi, '3.0.3');
      assert.strictEqual(res.body.info.title, 'DocChat API');
      assert.ok(res.body.paths['/api/documents']);
      assert.ok(res.body.paths['/api/chat']);
    });
  });
});
