const fs = require('fs');
const path = require('path');

class DocumentDB {
  constructor(storagePath) {
    this.storagePath = storagePath || path.join(__dirname, '..', 'data', 'documents.json');
    this.ensureDirectory();
    this.documents = this.load();
  }

  ensureDirectory() {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        return JSON.parse(data) || [];
      }
    } catch (err) {
      console.error('Error loading documents DB:', err);
    }
    return [];
  }

  save() {
    try {
      this.ensureDirectory();
      fs.writeFileSync(this.storagePath, JSON.stringify(this.documents, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving documents DB:', err);
      throw err;
    }
  }

  getAll() {
    // Return all documents sorted newest first
    return [...this.documents].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getById(id) {
    return this.documents.find((doc) => doc._id === id) || null;
  }

  insert(doc) {
    this.documents.unshift(doc);
    this.save();
    return doc;
  }

  delete(id) {
    const initialLen = this.documents.length;
    const docToDelete = this.getById(id);
    if (!docToDelete) return null;

    this.documents = this.documents.filter((doc) => doc._id !== id);
    if (this.documents.length < initialLen) {
      this.save();
      return docToDelete;
    }
    return null;
  }

  clear() {
    this.documents = [];
    this.save();
  }
}

// Default singleton instance using project data directory
const db = new DocumentDB();

module.exports = { DocumentDB, db };
