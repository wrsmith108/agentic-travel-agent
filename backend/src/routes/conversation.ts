/**
 * Conversation routes for AI chat interface
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '@/middleware/authNew';
import { validateRequest } from '@/middleware/validation';
import { isErr, isOk } from '@/utils/result';
import {
  createConversation,
  getConversation,
  getUserConversations,
  sendMessage,
  updateConversationContext,
  deleteConversation,
  clearConversation,
  exportConversation,
  asConversationId,
} from '@/services/ai/conversationService';
import {
  CreateConversationRequestSchema,
  UpdateContextRequestSchema,
  createConversationSuccess,
  createConversationListSuccess,
  createMessageSuccess,
  createConversationError,
} from '@/types/conversation';
import { UserId } from '@/types/brandedTypes';

const router = Router();

// Middleware to authenticate all conversation routes
router.use(authenticate);

/**
 * Create a new conversation
 * POST /api/v1/conversations
 */
router.post(
  '/',
  validateRequest(CreateConversationRequestSchema),
  async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const userId = UserId(req.user!.id);
      const { initialMessage } = req.body;

      const result = createConversation(userId, initialMessage);

      if (isErr(result)) {
        const { type, message, details } = result.error;
        const statusCode = type === 'RATE_LIMIT' ? 429 : 500;
        return res.status(statusCode).json(createConversationError(type, message, details));
      }

      // Convert to JSON-serializable format
      const conversation = {
        ...result.value,
        createdAt: result.value.createdAt,
        updatedAt: result.value.updatedAt,
        messages: result.value.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp,
        })),
      };

      return res.status(201).json(createConversationSuccess(conversation));
    } catch (error) {
      console.error('Create conversation error:', error);
      return res.status(500).json(
        createConversationError('SYSTEM_ERROR', 'Failed to create conversation')
      );
    }
  }
);

/**
 * Get all conversations for the authenticated user
 * GET /api/v1/conversations
 */
router.get('/', async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = UserId(req.user!.id);

    const result = getUserConversations(userId);

    if (isErr(result)) {
      const { type, message, details } = result.error;
      return res.status(500).json(createConversationError(type, message, details));
    }

    // Convert to JSON-serializable format
    const conversations = isOk(result) ? result.value : [].map(conv => ({
      ...conv,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messages: conv.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp,
      })),
    }));

    return res.json(createConversationListSuccess(conversations));
  } catch (error) {
    console.error('Get conversations error:', error);
    return res.status(500).json(
      createConversationError('SYSTEM_ERROR', 'Failed to get conversations')
    );
  }
});

/**
 * Get a specific conversation
 * GET /api/v1/conversations/:id
 */
router.get('/:id', async (req: Request, res: Response): Promise<Response | void> => {
  try {
    if (!req.params.id) {
      return res.status(400).json(
        createConversationError('INVALID_INPUT', 'Conversation ID is required')
      );
    }

    const userId = UserId(req.user!.id);
    const conversationId = asConversationId(req.params.id);

    const result = getConversation(conversationId, userId);

    if (isErr(result)) {
      const { type, message, details } = result.error;
      const statusCode = type === 'NOT_FOUND' ? 404 : 500;
      return res.status(statusCode).json(createConversationError(type, message, details));
    }

    // Convert to JSON-serializable format
    const conversation = {
      ...result.value,
      createdAt: result.value.createdAt,
      updatedAt: result.value.updatedAt,
      messages: result.value.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp,
      })),
    };

    return res.json(createConversationSuccess(conversation));
  } catch (error) {
    console.error('Get conversation error:', error);
    return res.status(500).json(
      createConversationError('SYSTEM_ERROR', 'Failed to get conversation')
    );
  }
});

/**
 * Send a message to a conversation
 * POST /api/v1/conversations/:id/messages
 */
router.post(
  '/:id/messages',
  validateRequest(
    z.object({
      content: z.string().min(1).max(4000),
    })
  ),
  async (req: Request, res: Response): Promise<Response | void> => {
    try {
      if (!req.params.id) {
        return res.status(400).json(
          createConversationError('INVALID_INPUT', 'Conversation ID is required')
        );
      }

      const userId = UserId(req.user!.id);
      const conversationId = asConversationId(req.params.id);
      const { content } = req.body;

      const result = await sendMessage(conversationId, userId, content);

      if (isErr(result)) {
        const { type, message, details } = result.error;
        const statusCode = 
          type === 'NOT_FOUND' ? 404 :
          type === 'RATE_LIMIT' ? 429 :
          type === 'INVALID_INPUT' ? 400 :
          500;
        return res.status(statusCode).json(createConversationError(type, message, details));
      }

      // Convert to JSON-serializable format
      const message = {
        ...result.value,
        timestamp: result.value.timestamp,
      };

      return res.json(createMessageSuccess(message));
    } catch (error) {
      console.error('Send message error:', error);
      return res.status(500).json(
        createConversationError('SYSTEM_ERROR', 'Failed to send message')
      );
    }
  }
);

/**
 * Update conversation context
 * PATCH /api/v1/conversations/:id/context
 */
router.patch(
  '/:id/context',
  validateRequest(UpdateContextRequestSchema.omit({ conversationId: true })),
  async (req: Request, res: Response): Promise<Response | void> => {
    try {
      if (!req.params.id) {
        return res.status(400).json(
          createConversationError('INVALID_INPUT', 'Conversation ID is required')
        );
      }

      const userId = UserId(req.user!.id);
      const conversationId = asConversationId(req.params.id);
      const { context } = req.body;

      const result = updateConversationContext(conversationId, userId, context);

      if (isErr(result)) {
        const { type, message, details } = result.error;
        const statusCode = type === 'NOT_FOUND' ? 404 : 500;
        return res.status(statusCode).json(createConversationError(type, message, details));
      }

      // Convert to JSON-serializable format
      const conversation = {
        ...result.value,
        createdAt: result.value.createdAt,
        updatedAt: result.value.updatedAt,
        messages: result.value.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp,
        })),
      };

      return res.json(createConversationSuccess(conversation));
    } catch (error) {
      console.error('Update context error:', error);
      return res.status(500).json(
        createConversationError('SYSTEM_ERROR', 'Failed to update context')
      );
    }
  }
);

/**
 * Clear conversation messages
 * POST /api/v1/conversations/:id/clear
 */
router.post('/:id/clear', async (req: Request, res: Response): Promise<Response | void> => {
  try {
    if (!req.params.id) {
      return res.status(400).json(
        createConversationError('INVALID_INPUT', 'Conversation ID is required')
      );
    }

    const userId = UserId(req.user!.id);
    const conversationId = asConversationId(req.params.id);

    const result = clearConversation(conversationId, userId);

    if (isErr(result)) {
      const { type, message, details } = result.error;
      const statusCode = type === 'NOT_FOUND' ? 404 : 500;
      return res.status(statusCode).json(createConversationError(type, message, details));
    }

    // Convert to JSON-serializable format
    const conversation = {
      ...result.value,
      createdAt: result.value.createdAt,
      updatedAt: result.value.updatedAt,
      messages: [],
    };

    return res.json(createConversationSuccess(conversation));
  } catch (error) {
    console.error('Clear conversation error:', error);
    return res.status(500).json(
      createConversationError('SYSTEM_ERROR', 'Failed to clear conversation')
    );
  }
});

/**
 * Export conversation as markdown
 * GET /api/v1/conversations/:id/export
 */
router.get('/:id/export', async (req: Request, res: Response): Promise<Response | void> => {
  try {
    if (!req.params.id) {
      return res.status(400).json(
        createConversationError('INVALID_INPUT', 'Conversation ID is required')
      );
    }

    const userId = UserId(req.user!.id);
    const conversationId = asConversationId(req.params.id);

    const result = exportConversation(conversationId, userId);

    if (isErr(result)) {
      const { type, message, details } = result.error;
      const statusCode = type === 'NOT_FOUND' ? 404 : 500;
      return res.status(statusCode).json(createConversationError(type, message, details));
    }

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="conversation-${conversationId}.md"`);
    return res.send(result.value);
  } catch (error) {
    console.error('Export conversation error:', error);
    return res.status(500).json(
      createConversationError('SYSTEM_ERROR', 'Failed to export conversation')
    );
  }
});

/**
 * Delete a conversation
 * DELETE /api/v1/conversations/:id
 */
router.delete('/:id', async (req: Request, res: Response): Promise<Response | void> => {
  try {
    if (!req.params.id) {
      return res.status(400).json(
        createConversationError('INVALID_INPUT', 'Conversation ID is required')
      );
    }

    const userId = UserId(req.user!.id);
    const conversationId = asConversationId(req.params.id);

    const result = deleteConversation(conversationId, userId);

    if (isErr(result)) {
      const { type, message, details } = result.error;
      const statusCode = type === 'NOT_FOUND' ? 404 : 500;
      return res.status(statusCode).json(createConversationError(type, message, details));
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Delete conversation error:', error);
    return res.status(500).json(
      createConversationError('SYSTEM_ERROR', 'Failed to delete conversation')
    );
  }
});

export default router;