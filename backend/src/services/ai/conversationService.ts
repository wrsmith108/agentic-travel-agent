/**
 * AI Conversation Service using Claude API
 * Handles travel-related conversations with context and memory
 */

import Anthropic from '@anthropic-ai/sdk';
import { Result, ok, err, map, flatMap, isOk } from '@/utils/result';
import { v4 as uuidv4 } from 'uuid';
import { UserId } from '@/types/brandedTypes';

// Types
export type ConversationId = string & { readonly brand: unique symbol };
export type MessageId = string & { readonly brand: unique symbol };

export interface Message {
  id: MessageId;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokenCount?: number;
    searchResults?: any[];
  };
}

export interface Conversation {
  id: ConversationId;
  userId: UserId;
  title: string;
  messages: Message[];
  context: ConversationContext;
  createdAt: Date;
  updatedAt: Date;
  active: boolean;
}

export interface ConversationContext {
  preferences?: {
    budget?: number;
    departureAirport?: string;
    destinations?: string[];
    travelDates?: {
      start?: string;
      end?: string;
      flexible?: boolean;
    };
    travelers?: {
      adults: number;
      children: number;
      infants: number;
    };
    interests?: string[];
  };
  searchHistory?: any[];
  bookingHistory?: any[];
}

export interface ConversationError {
  type: 'NOT_FOUND' | 'API_ERROR' | 'RATE_LIMIT' | 'INVALID_INPUT' | 'SYSTEM_ERROR';
  message: string;
  details?: any;
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// In-memory storage (replace with database in production)
const conversations = new Map<ConversationId, Conversation>();
const userConversations = new Map<UserId, ConversationId[]>();

// Helper functions
export const asConversationId = (id: string): ConversationId => id as ConversationId;
export const asMessageId = (id: string): MessageId => id as MessageId;

const createError = (type: ConversationError['type'], message: string, details?: any): ConversationError => ({
  type,
  message,
  details,
});

/**
 * Create a new conversation
 */
export const createConversation = (
  userId: UserId,
  initialMessage?: string
): Result<Conversation, ConversationError> => {
  try {
    const conversationId = asConversationId(uuidv4());
    
    const conversation: Conversation = {
      id: conversationId,
      userId,
      title: initialMessage ? initialMessage.slice(0, 50) + '...' : 'New Conversation',
      messages: [],
      context: {
        preferences: {
          travelers: { adults: 1, children: 0, infants: 0 },
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      active: true,
    };

    // Store conversation
    conversations.set(conversationId, conversation);
    
    // Update user's conversation list
    const userConvIds = userConversations.get(userId) || [];
    userConvIds.push(conversationId);
    userConversations.set(userId, userConvIds);

    return ok(conversation);
  } catch (error) {
    return err(createError(
      'SYSTEM_ERROR',
      'Failed to create conversation',
      error
    ));
  }
};

/**
 * Get conversation by ID
 */
export const getConversation = (
  conversationId: ConversationId,
  userId: UserId
): Result<Conversation, ConversationError> => {
  const conversation = conversations.get(conversationId);
  
  if (!conversation) {
    return err(createError('NOT_FOUND', 'Conversation not found'));
  }
  
  if (conversation.userId !== userId) {
    return err(createError('NOT_FOUND', 'Conversation not found'));
  }
  
  return ok(conversation);
};

/**
 * Get all conversations for a user
 */
export const getUserConversations = (
  userId: UserId
): Result<Conversation[], ConversationError> => {
  const conversationIds = userConversations.get(userId) || [];
  
  const userConvs = conversationIds
    .map(id => conversations.get(id))
    .filter((conv): conv is Conversation => conv !== undefined)
    .filter(conv => conv.active)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  
  return ok(userConvs);
};

/**
 * Update conversation context
 */
export const updateConversationContext = (
  conversationId: ConversationId,
  userId: UserId,
  contextUpdate: Partial<ConversationContext>
): Result<Conversation, ConversationError> => {
  const convResult = getConversation(conversationId, userId);
  
  if (!convResult.ok) {
    return convResult;
  }
  
  const conversation = isOk(convResult) ? convResult.value : null;
  
  // Deep merge context
  conversation.context = {
    ...conversation.context,
    preferences: {
      ...conversation.context.preferences,
      ...contextUpdate.preferences,
    },
    searchHistory: contextUpdate.searchHistory || conversation.context.searchHistory,
    bookingHistory: contextUpdate.bookingHistory || conversation.context.bookingHistory,
  };
  
  conversation.updatedAt = new Date();
  
  return ok(conversation);
};

/**
 * Send message and get AI response
 */
export const sendMessage = async (
  conversationId: ConversationId,
  userId: UserId,
  content: string
): Promise<Result<Message, ConversationError>> => {
  try {
    // Get conversation
    const convResult = getConversation(conversationId, userId);
    if (!convResult.ok) {
      return err((convResult as any).error);
    }
    
    const conversation = isOk(convResult) ? convResult.value : null;
    
    // Create user message
    const userMessage: Message = {
      id: asMessageId(uuidv4()),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    
    conversation.messages.push(userMessage);
    
    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(conversation.context);
    
    // Build messages for Claude
    const claudeMessages = conversation.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));
    
    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      temperature: 0.7,
      system: systemPrompt,
      messages: claudeMessages,
    });
    
    // Extract text content from response
    const rawContent = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('\n');
    
    // Format the response content
    const formattedContent = formatAgentResponse(rawContent);
    
    // Create assistant message
    const assistantMessage: Message = {
      id: asMessageId(uuidv4()),
      role: 'assistant',
      content: formattedContent,
      timestamp: new Date(),
      metadata: {
        model: response.model,
        tokenCount: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
    
    conversation.messages.push(assistantMessage);
    conversation.updatedAt = new Date();
    
    // Update title if it's the first exchange
    if (conversation.messages.length === 2) {
      conversation.title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
    }
    
    return ok(assistantMessage);
  } catch (error: any) {
    if (error.status === 429) {
      return err(createError('RATE_LIMIT', 'Rate limit exceeded. Please try again later.'));
    }
    
    return err(createError(
      'API_ERROR',
      'Failed to get AI response',
      error.message
    ));
  }
};

/**
 * Format agent response with better structure and extract questions
 */
const formatAgentResponse = (rawContent: string): string => {
  let content = rawContent.trim();
  
  // Extract questions from the content using a more sophisticated approach
  const questionRegex = /([^.!?]*\?)/g;
  const questions = content.match(questionRegex) || [];
  
  // Clean up questions and remove them from main content
  const cleanQuestions = questions
    .map(q => q.trim())
    .filter(q => q.length > 5 && !q?.includes('wondering') && !q?.includes('asking'))
    .map(q => {
      // Remove leading connectors and clean up
      return q.replace(/^(and|or|but|so|also|additionally)\s+/i, '')
              .replace(/^\s*[-•]\s*/, '') // Remove bullet points
              .trim();
    })
    .filter(q => q.length > 0)
    .slice(0, 5); // Limit to 5 questions max
  
  // Remove questions from main content for cleaner formatting
  let mainContent = content;
  cleanQuestions.forEach(q => {
    // Try to remove the question and surrounding context
    const originalQ = questions.find((orig: string) => orig && orig.includes(q.split('?')[0]));
    if (originalQ) {
      mainContent = mainContent.replace(originalQ, '');
    }
  });
  
  // Clean up the main content
  mainContent = mainContent
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\./g, '.')
    .replace(/,\s*,/g, ',')
    .replace(/\s+([.!?])/g, '$1') // Fix spacing before punctuation
    .trim();
  
  // Format the main content with better structure
  const sentences = mainContent.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  let formattedContent = '';
  
  sentences.forEach((sentence, index) => {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) return;
    
    // Add sentence to content
    if (index > 0) formattedContent += ' ';
    
    // Add emphasis to important phrases
    let formatted = trimmed;
    
    // Emphasize airport codes
    formatted = formatted.replace(/\b([A-Z]{3})\b/g, '**$1**');
    
    // Emphasize important travel terms
    formatted = formatted.replace(/\b(departure|arrival|flight|booking|price|cost|budget|destination|travel)\b/gi, '**$1**');
    
    formattedContent += formatted;
  });
  
  // Add questions section if we found any
  if (cleanQuestions.length > 0) {
    formattedContent += '\n\n---\n\n### Questions for you:\n\n';
    cleanQuestions.forEach((question, index) => {
      formattedContent += `${index + 1}. ${question}\n`;
    });
  }
  
  return formattedContent;
};

/**
 * Build system prompt with conversation context
 */
const buildSystemPrompt = (context: ConversationContext): string => {
  const { preferences } = context;
  
  let prompt = `You are a helpful AI travel agent assistant. You help users plan their trips, find flights, suggest destinations, and provide travel advice.

Key capabilities:
- Flight search and recommendations
- Destination suggestions based on preferences
- Travel planning and itinerary creation
- Budget optimization
- Local tips and cultural insights
- Visa and documentation guidance

FORMATTING GUIDELINES:
- Structure your responses with clear paragraphs
- Use natural language and be conversational
- When listing items, use bullet points (- or •)
- Always end with specific questions to help the user, if appropriate
- Mention airport codes in capital letters (JFK, LAX, CDG)
- Keep responses organized and easy to read

IMPORTANT: When users ask about specific flights or flight prices, tell them you can search for real flights. Suggest using specific dates, airports (3-letter codes like JFK, LAX), and let them know you'll need:
- Origin airport (e.g., JFK for New York)
- Destination airport (e.g., CDG for Paris)
- Travel dates
- Number of travelers

Always be helpful, friendly, and professional. When you need more information, ask clear, specific questions.`;
  
  if (preferences) {
    prompt += '\n\nUser preferences:';
    
    if (preferences.budget) {
      prompt += `\n- Budget: $${preferences.budget}`;
    }
    
    if (preferences.departureAirport) {
      prompt += `\n- Departure airport: ${preferences.departureAirport}`;
    }
    
    if (preferences.destinations?.length) {
      prompt += `\n- Interested in: ${preferences.destinations.join(', ')}`;
    }
    
    if (preferences.travelDates) {
      const { start, end, flexible } = preferences.travelDates;
      if (start || end) {
        prompt += `\n- Travel dates: ${start || 'TBD'} to ${end || 'TBD'}${flexible ? ' (flexible)' : ''}`;
      }
    }
    
    if (preferences.travelers) {
      const { adults, children, infants } = preferences.travelers;
      const travelers = [];
      if (adults > 0) travelers.push(`${adults} adult${adults > 1 ? 's' : ''}`);
      if (children > 0) travelers.push(`${children} child${children > 1 ? 'ren' : ''}`);
      if (infants > 0) travelers.push(`${infants} infant${infants > 1 ? 's' : ''}`);
      if (travelers.length > 0) {
        prompt += `\n- Travelers: ${travelers.join(', ')}`;
      }
    }
    
    if (preferences.interests?.length) {
      prompt += `\n- Interests: ${preferences.interests.join(', ')}`;
    }
  }
  
  return prompt;
};

/**
 * Delete conversation
 */
export const deleteConversation = (
  conversationId: ConversationId,
  userId: UserId
): Result<void, ConversationError> => {
  const convResult = getConversation(conversationId, userId);
  
  if (!convResult.ok) {
    return err((convResult as any).error);
  }
  
  const conversation = isOk(convResult) ? convResult.value : null;
  conversation.active = false;
  conversation.updatedAt = new Date();
  
  return ok(undefined);
};

/**
 * Clear all messages in a conversation
 */
export const clearConversation = (
  conversationId: ConversationId,
  userId: UserId
): Result<Conversation, ConversationError> => {
  const convResult = getConversation(conversationId, userId);
  
  if (!convResult.ok) {
    return convResult;
  }
  
  const conversation = isOk(convResult) ? convResult.value : null;
  conversation.messages = [];
  conversation.updatedAt = new Date();
  conversation.title = 'New Conversation';
  
  return ok(conversation);
};

/**
 * Export conversation as markdown
 */
export const exportConversation = (
  conversationId: ConversationId,
  userId: UserId
): Result<string, ConversationError> => {
  const convResult = getConversation(conversationId, userId);
  
  if (!convResult.ok) {
    return err((convResult as any).error);
  }
  
  const conversation = isOk(convResult) ? convResult.value : null;
  
  let markdown = `# ${conversation.title}\n\n`;
  markdown += `Created: ${conversation.createdAt.toLocaleString()}\n\n`;
  
  conversation.messages.forEach(message => {
    const role = message.role === 'user' ? '**You**' : '**Assistant**';
    markdown += `${role} (${message.timestamp.toLocaleTimeString()}):\n`;
    markdown += `${message.content}\n\n`;
  });
  
  return ok(markdown);
};