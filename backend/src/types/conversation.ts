/**
 * Conversation type definitions
 */

import { z } from 'zod';

// Branded types
// Removed - using @/types/brandedTypes: export type ConversationId = string & { readonly brand: unique symbol };
// Removed - using @/types/brandedTypes: export type MessageId = string & { readonly brand: unique symbol };

// Message schema
export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  timestamp: z.string().datetime(),
  metadata: z.object({
    model: z.string().optional(),
    tokenCount: z.number().optional(),
    searchResults: z.array(z.any()).optional(),
  }).optional(),
});

// Conversation context schema
export const ConversationContextSchema = z.object({
  preferences: z.object({
    budget: z.number().min(0).optional(),
    departureAirport: z.string().length(3).optional(),
    destinations: z.array(z.string()).optional(),
    travelDates: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
      flexible: z.boolean().optional(),
    }).optional(),
    travelers: z.object({
      adults: z.number().min(1).default(1),
      children: z.number().min(0).default(0),
      infants: z.number().min(0).default(0),
    }).optional(),
    interests: z.array(z.string()).optional(),
  }).optional(),
  searchHistory: z.array(z.any()).optional(),
  bookingHistory: z.array(z.any()).optional(),
});

// Conversation schema
export const ConversationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  messages: z.array(MessageSchema),
  context: ConversationContextSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  active: z.boolean().default(true),
});

// Request schemas
export const CreateConversationRequestSchema = z.object({
  initialMessage: z.string().optional(),
});

export const SendMessageRequestSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1).max(4000),
});

export const UpdateContextRequestSchema = z.object({
  conversationId: z.string(),
  context: ConversationContextSchema.partial(),
});

// Response schemas
export const ConversationResponseSchema = z.object({
  success: z.literal(true),
  data: ConversationSchema,
});

export const ConversationListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(ConversationSchema),
});

export const MessageResponseSchema = z.object({
  success: z.literal(true),
  data: MessageSchema,
});

// Error types
export const ConversationErrorType = z.enum([
  'NOT_FOUND',
  'API_ERROR',
  'RATE_LIMIT',
  'INVALID_INPUT',
  'SYSTEM_ERROR',
]);

export const ConversationErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    type: ConversationErrorType,
    message: z.string(),
    details: z.any().optional(),
  }),
});

// TypeScript types
export type Message = z.infer<typeof MessageSchema>;
export type ConversationContext = z.infer<typeof ConversationContextSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>;
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
export type UpdateContextRequest = z.infer<typeof UpdateContextRequestSchema>;
export type ConversationResponse = z.infer<typeof ConversationResponseSchema>;
export type ConversationListResponse = z.infer<typeof ConversationListResponseSchema>;
export type MessageResponse = z.infer<typeof MessageResponseSchema>;
export type ConversationError = z.infer<typeof ConversationErrorSchema>;
export type ConversationErrorType = z.infer<typeof ConversationErrorType>;

// Helper functions
export const createConversationSuccess = (conversation: Conversation): ConversationResponse => ({
  success: true,
  data: conversation,
});

export const createConversationListSuccess = (conversations: Conversation[]): ConversationListResponse => ({
  success: true,
  data: conversations,
});

export const createMessageSuccess = (message: Message): MessageResponse => ({
  success: true,
  data: message,
});

export const createConversationError = (
  type: ConversationErrorType,
  message: string,
  details?: any
): ConversationError => ({
  success: false,
  error: {
    type,
    message,
    details,
  },
});
// Re-export branded types from canonical source
export { ConversationId, MessageId } from '@/types/brandedTypes';
