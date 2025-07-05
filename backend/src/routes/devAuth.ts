import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/middleware/errorHandler';
import { createSession } from '@/services/auth/functional/session';
import { createTimestamp } from '@/services/auth/functional/types';
import type { SessionUser } from '@/services/auth/functional/types';

const router = Router();

/**
 * Development authentication endpoint
 * Generates valid JWT tokens for testing frontend integration
 * Only available in development mode
 */
router.post('/mock-token', async (req, res) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    throw new AppError(403, 'Not available in production', 'DEV_ONLY');
  }

  try {
    // Create a mock user session
    const userId = req.body.userId || 'dev-user-123';
    const email = req.body.email || 'dev@example.com';

    // Create mock user data
    const mockUser: SessionUser = {
      id: userId,
      email: email,
      firstName: 'Dev',
      lastName: 'User',
      role: 'user' as const,
      isEmailVerified: true,
      createdAt: createTimestamp(),
    };

    // Create session using functional auth service public API
    const deviceInfo = {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'dev-client',
    };

    const sessionResult = await createSession({
      user: mockUser,
      duration: 86400, // 24 hours
      deviceInfo
    });
    
    const { accessToken, sessionId, expiresAt } = sessionResult;

    res.json({
      success: true,
      data: {
        token: accessToken,
        user: mockUser,
        sessionId: sessionId,
        expiresAt: expiresAt,
        expiresIn: 86400, // 24 hours in seconds
      }
    });

  } catch (error) {
    console.error('Mock token generation failed:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code || 'MOCK_TOKEN_FAILED',
          message: error.message
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'MOCK_TOKEN_FAILED',
          message: 'Failed to generate mock authentication token'
        }
      });
    }
  }
});

export default router;