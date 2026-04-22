/**
 * Swagger / OpenAPI 3.0 specification for the KMS API.
 * Served at GET /api/docs (UI) and GET /api/docs.json (raw spec).
 *
 * Install required packages:
 *   npm install swagger-ui-express
 *   npm install --save-dev @types/swagger-ui-express
 */

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Knowledge Management System API',
    version: '1.0.0',
    description:
      'REST API for the KMS application — authentication, document management, and semantic search.',
    contact: {
      name: 'KMS Team',
    },
  },
  servers: [
    { url: '/api', description: 'Current environment' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from POST /auth/login',
      },
    },
    schemas: {
      // ── Common ─────────────────────────────────────────────────────
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              details: { type: 'object', nullable: true },
            },
          },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      // ── Auth ───────────────────────────────────────────────────────
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: {
            type: 'string',
            minLength: 8,
            description: 'Min 8 chars, must contain uppercase and number',
          },
          firstName: { type: 'string', minLength: 2 },
          lastName: { type: 'string', minLength: 2 },
          telephone: { type: 'string', nullable: true },
          department: { type: 'string', nullable: true },
          jobTitle: { type: 'string', nullable: true },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              user: { $ref: '#/components/schemas/User' },
            },
          },
        },
      },
      // ── User ───────────────────────────────────────────────────────
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          telephone: { type: 'string', nullable: true },
          department: { type: 'string', nullable: true },
          jobTitle: { type: 'string', nullable: true },
          role: { type: 'string', enum: ['admin', 'staff', 'viewer'] },
          status: { type: 'string', enum: ['pending', 'waiting', 'active', 'disabled'] },
          emailVerified: { type: 'boolean' },
          avatarUrl: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // ── Document ───────────────────────────────────────────────────
      Document: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          fileName: { type: 'string' },
          fileType: { type: 'string', enum: ['txt', 'md', 'pdf'] },
          fileSize: { type: 'integer', description: 'File size in bytes' },
          status: { type: 'string', enum: ['uploaded', 'processing', 'ready', 'failed'] },
          chunkCount: { type: 'integer' },
          errorMessage: { type: 'string', nullable: true },
          uploadedBy: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              department: { type: 'string', nullable: true },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      // ── Search ─────────────────────────────────────────────────────
      SearchRequest: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1, example: 'What is the company leave policy?' },
          top_k: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
          filters: {
            type: 'object',
            properties: {
              department: { type: 'string', nullable: true },
              file_type: { type: 'string', enum: ['txt', 'md', 'pdf'], nullable: true },
            },
          },
        },
      },
      SearchResult: {
        type: 'object',
        properties: {
          document_id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          chunk_text: { type: 'string' },
          similarity_score: { type: 'number', minimum: 0, maximum: 1 },
          file_type: { type: 'string' },
          department: { type: 'string', nullable: true },
          uploaded_by: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // ── Health ──────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: {
          '200': {
            description: 'All services healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    status: { type: 'string', enum: ['healthy', 'degraded'] },
                    checks: {
                      type: 'object',
                      properties: {
                        postgres: { type: 'boolean' },
                        redis: { type: 'boolean' },
                        python_service: { type: 'boolean' },
                      },
                    },
                    uptime: { type: 'number' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '503': { description: 'One or more services degraded' },
        },
      },
    },
    // ── Auth ────────────────────────────────────────────────────────
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user account',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          '201': { description: 'Registration successful — verification email sent' },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '409': { description: 'Email already registered' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login with email and password',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          '200': { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          '401': { description: 'Invalid credentials or account not active' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token using refresh token cookie',
        security: [],
        responses: {
          '200': { description: 'New access token issued' },
          '401': { description: 'Invalid or expired refresh token' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Invalidate the current refresh token',
        responses: {
          '200': { description: 'Logged out successfully' },
        },
      },
    },
    '/auth/verify-email/{token}': {
      get: {
        tags: ['Authentication'],
        summary: 'Verify email address using token from email link',
        security: [],
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Email verified — account awaiting admin approval' },
          '400': { description: 'Invalid or expired token' },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Request a temporary password via email',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } } } } },
        },
        responses: {
          '200': { description: 'If the email exists, a temporary password has been sent' },
        },
      },
    },
    // ── Users ───────────────────────────────────────────────────────
    '/users/profile': {
      get: {
        tags: ['Users'],
        summary: 'Get current user profile',
        responses: {
          '200': { description: 'User profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Update own profile',
        responses: { '200': { description: 'Profile updated' } },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List all users (admin only)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'waiting', 'active', 'disabled'] } },
        ],
        responses: { '200': { description: 'User list with pagination' } },
      },
    },
    '/users/{id}/approve': {
      patch: {
        tags: ['Users'],
        summary: 'Approve a waiting user (admin only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'User approved and activation email sent' } },
      },
    },
    '/users/{id}/reject': {
      patch: {
        tags: ['Users'],
        summary: 'Reject a waiting user (admin only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'User rejected' } },
      },
    },
    // ── Documents ───────────────────────────────────────────────────
    '/documents': {
      get: {
        tags: ['Documents'],
        summary: 'List documents with filters and pagination',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['uploaded', 'processing', 'ready', 'failed'] } },
          { name: 'file_type', in: 'query', schema: { type: 'string', enum: ['txt', 'md', 'pdf'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': {
            description: 'Document list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        documents: { type: 'array', items: { $ref: '#/components/schemas/Document' } },
                        meta: { $ref: '#/components/schemas/PaginationMeta' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/documents/upload': {
      post: {
        tags: ['Documents'],
        summary: 'Upload a document for OCR and vectorization (staff/admin only)',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'title'],
                properties: {
                  file: { type: 'string', format: 'binary', description: '.txt, .md, or .pdf — max 50MB' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Document accepted for processing' },
          '400': { description: 'Invalid file type or size' },
          '403': { description: 'Staff or admin role required' },
        },
      },
    },
    '/documents/{id}': {
      get: {
        tags: ['Documents'],
        summary: 'Get document metadata',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Document metadata', content: { 'application/json': { schema: { $ref: '#/components/schemas/Document' } } } },
          '404': { description: 'Document not found' },
        },
      },
      delete: {
        tags: ['Documents'],
        summary: 'Delete a document (owner or admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Document deleted' },
          '403': { description: 'Not the document owner or admin' },
          '404': { description: 'Document not found' },
        },
      },
    },
    '/documents/{id}/status': {
      get: {
        tags: ['Documents'],
        summary: 'Poll document processing status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Current processing status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    status: { type: 'string', enum: ['uploaded', 'processing', 'ready', 'failed'] },
                    chunkCount: { type: 'integer' },
                    errorMessage: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/documents/{id}/content': {
      get: {
        tags: ['Documents'],
        summary: 'Get extracted text content of a ready document',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Extracted text content' },
          '409': { description: 'Document is not in ready state' },
        },
      },
    },
    // ── Search ──────────────────────────────────────────────────────
    '/search': {
      post: {
        tags: ['Search'],
        summary: 'Semantic search across all indexed documents',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SearchRequest' } } },
        },
        responses: {
          '200': {
            description: 'Search results ranked by similarity',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        results: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } },
                        total: { type: 'integer' },
                        query_time_ms: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          '502': { description: 'Python search service unavailable' },
        },
      },
    },
    '/search/suggestions': {
      get: {
        tags: ['Search'],
        summary: 'Get filter suggestions (departments, file types)',
        parameters: [{ name: 'type', in: 'query', schema: { type: 'string', enum: ['department'] } }],
        responses: { '200': { description: 'Filter option lists' } },
      },
    },
    // ── Admin ───────────────────────────────────────────────────────
    '/admin/dashboard': {
      get: {
        tags: ['Admin'],
        summary: 'System-wide statistics (admin only)',
        responses: { '200': { description: 'Dashboard metrics' } },
      },
    },
    '/admin/audit-logs': {
      get: {
        tags: ['Admin'],
        summary: 'Query audit logs (admin only)',
        parameters: [
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'userId', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Audit log entries with pagination' } },
      },
    },
  },
};
