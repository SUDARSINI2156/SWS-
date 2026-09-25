const swaggerUi = require('swagger-ui-express');

const openapiSpecification = {
  openapi: '3.0.3',
  info: {
    title: 'DocChat API',
    version: '1.0.0',
    description:
      'Interactive API documentation for DocChat — Document Manager with AI Assistant. Supports document upload, retrieval, download, deletion, and AI-powered question answering with source citations.',
    contact: {
      name: 'DocChat Team'
    }
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local server'
    },
    {
      url: '/',
      description: 'Current host'
    }
  ],
  paths: {
    '/api/documents': {
      get: {
        summary: 'List all uploaded documents',
        description: 'Returns all documents, with the newest documents appearing first.',
        tags: ['Documents'],
        responses: {
          200: {
            description: 'A list of document objects sorted newest first.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Document'
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: 'Upload a new document',
        description: 'Accepts a document file (.txt, .md, .json, .pdf, .docx, etc.), extracts its text content, and persists metadata.',
        tags: ['Documents'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'The file to upload (up to 10 MB)'
                  }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Document successfully uploaded and indexed.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Document'
                }
              }
            }
          },
          400: {
            description: 'Missing file, invalid file format, or file exceeds size limit.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/documents/{id}': {
      get: {
        summary: 'Get document details by ID',
        description: 'Retrieve metadata and information for a specific document.',
        tags: ['Documents'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'The unique document ID',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          200: {
            description: 'Document metadata found.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Document'
                }
              }
            }
          },
          404: {
            description: 'Document not found.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      },
      delete: {
        summary: 'Delete document by ID',
        description: 'Removes both the document metadata and its associated file from storage.',
        tags: ['Documents'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'The unique document ID to delete',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          200: {
            description: 'Document deleted successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Document deleted successfully' },
                    id: { type: 'string', example: 'd3b07384-d113-46fb-9c8e-a2c31e724505' }
                  }
                }
              }
            }
          },
          404: {
            description: 'Document not found.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/documents/{id}/download': {
      get: {
        summary: 'Download document file',
        description: 'Downloads the original file previously uploaded.',
        tags: ['Documents'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'The unique document ID',
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          200: {
            description: 'The binary file stream.',
            content: {
              'application/octet-stream': {
                schema: {
                  type: 'string',
                  format: 'binary'
                }
              }
            }
          },
          404: {
            description: 'Document or associated file not found.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/chat': {
      post: {
        summary: 'Ask a question about uploaded documents',
        description:
          'Searches stored documents for relevant content, ranks them, constructs context, and generates an answer with sources.',
        tags: ['Chat & AI QA'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ChatRequest'
              }
            }
          }
        },
        responses: {
          200: {
            description: 'AI answer generated with sources.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ChatResponse'
                }
              }
            }
          },
          400: {
            description: 'Invalid or empty question provided.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      Document: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: 'c645ba36-8e59-4d64-a690-3ce48eb9204b'
          },
          originalName: {
            type: 'string',
            example: 'leave-policy.txt'
          },
          mimetype: {
            type: 'string',
            example: 'text/plain'
          },
          size: {
            type: 'integer',
            example: 1024
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-09-25T10:00:00.000Z'
          },
          text: {
            type: 'string',
            description: 'Extracted text content',
            example: 'Company Leave Policy...'
          }
        }
      },
      ChatRequest: {
        type: 'object',
        required: ['question'],
        properties: {
          question: {
            type: 'string',
            example: 'What is the annual leave allowance?'
          }
        }
      },
      SourceItem: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: 'c645ba36-8e59-4d64-a690-3ce48eb9204b'
          },
          originalName: {
            type: 'string',
            example: 'leave-policy.txt'
          }
        }
      },
      ChatResponse: {
        type: 'object',
        properties: {
          answer: {
            type: 'string',
            example: 'Full-time employees are entitled to 20 days of paid annual leave per year.'
          },
          sources: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/SourceItem'
            }
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            example: 'Question cannot be empty'
          }
        }
      }
    }
  }
};

function setupSwagger(app) {
  // Machine-readable OpenAPI JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openapiSpecification);
  });

  // Interactive Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification));
}

module.exports = {
  openapiSpecification,
  setupSwagger
};
