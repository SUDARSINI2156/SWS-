# DocChat — Document Manager with AI Assistant

DocChat is a modern, full-stack document management application that enables users to upload, manage, view, download, and delete documents, as well as interact with them via an AI-powered question-answering interface with citation tracking.

![DocChat UI](public/index.html)

---

## ✨ Features

- **Document Management**:
  - **Upload**: Accepts documents via drag-and-drop or file picker with progress bar and format validation.
  - **Text Extraction**: Automatic extraction for `.txt`, `.md`, `.json`, `.pdf`, and `.docx`.
  - **Listing & Search**: Real-time document list sorted newest first with instant keyword search.
  - **Storage & Document Stats**: Live counters for total document count and disk storage usage.
  - **Download**: Instant 1-click download of previously uploaded documents.
  - **Delete**: Delete confirmation modal with simultaneous disk and metadata cleanup.
- **AI-Powered Question Answering**:
  - Keyword overlap & text matching ranking algorithm.
  - Builds grounded context from the most relevant documents.
  - Generates answers citing the exact source documents used.
  - **Zero External API Key Required**: Built-in extractive local QA fallback works out-of-the-box.
  - Optional LLM integration via `OPENAI_API_KEY` or `GEMINI_API_KEY`.
  - Error validation: 400 Bad Request for empty or missing questions.
- **Interactive OpenAPI Documentation**:
  - Full OpenAPI 3.0 specification available at `/api-docs.json`.
  - Interactive Swagger UI available at `/api-docs`.
- **Automated Test Suite**:
  - 100% test pass rate covering uploads, listings, downloads, deletions, validations, chat, and OpenAPI.

---

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js
- **File Handling**: Multer, `pdf-parse`, `mammoth`
- **Frontend**: Tailwind CSS, Lucide icons, Glassmorphism UI with Dark/Light theme toggle
- **API Documentation**: OpenAPI 3.0 / Swagger UI (`swagger-ui-express`)
- **Testing**: Node.js Native Test Runner (`node:test`, `node:assert`), Supertest

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Run the Server
```bash
npm start
```
The application will be live at:
- **Web Interface**: [http://localhost:4000](http://localhost:4000)
- **Interactive Swagger Docs**: [http://localhost:4000/api-docs](http://localhost:4000/api-docs)
- **OpenAPI JSON Spec**: [http://localhost:4000/api-docs.json](http://localhost:4000/api-docs.json)

### 3. Run Automated Tests
```bash
npm test
```

---

## 📖 API Reference

### Document Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/documents` | List all documents, sorted newest first |
| `POST` | `/api/documents` | Upload a new document (`multipart/form-data`) |
| `GET` | `/api/documents/:id` | Get document metadata by ID |
| `GET` | `/api/documents/:id/download` | Download document original file |
| `DELETE` | `/api/documents/:id` | Delete document metadata and stored file |

### Chat / AI Endpoint

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Ask questions grounded in uploaded documents |

#### Request Example:
```json
POST /api/chat
Content-Type: application/json

{
  "question": "What is the annual leave allowance?"
}
```

#### Response Example:
```json
{
  "answer": "Based on leave-policy.txt:\n\n\"All full-time employees are entitled to 20 days of paid annual leave per calendar year.\"",
  "sources": [
    {
      "_id": "c645ba36-8e59-4d64-a690-3ce48eb9204b",
      "originalName": "leave-policy.txt"
    }
  ]
}
```

---

## 🧪 Testing Coverage

The automated test suite verifies:
- `.txt`, `.md`, `.json` document uploads and content extraction.
- Rejection of empty uploads and invalid/unsupported file types (400 Bad Request).
- Document listing ordered with newest first.
- Direct file download with appropriate `Content-Disposition` headers.
- Deletion of document metadata and physical file removal.
- Non-existent document 404 error handling.
- Question answering with answer generation and source document citations.
- Validation on empty or whitespace-only questions (400 Bad Request).
- OpenAPI specification integrity and endpoint availability.
