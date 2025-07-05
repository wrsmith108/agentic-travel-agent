/**
 * User Preferences Routes
 * Handles all preference-related API endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { attachSessionInfo, getSessionData } from '@/middleware/session';
import { requireAuth } from '@/middleware/auth';
import { sanitizeInputs } from '@/middleware/inputSanitization';
import { userPreferencesService } from '@/services/preferences/userPreferencesService';
import { createRequestLogger } from '@/utils/logger';
import { isOk, isErr } from '@/utils/result';
import { UserId } from '@/types/brandedTypes';
import { UserPreferencesUpdateSchema } from '@/schemas/preferences';
import { zodToResult } from '@/utils/zodToResult';

const router = Router();

// Apply middleware
router.use(attachSessionInfo);
router.use(requireAuth);
router.use(sanitizeInputs);

/**
 * Get user preferences
 * GET /api/v1/preferences
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(uuidv4());
  
  try {
    const userId = getSessionData(req)?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    requestLogger.info('Fetching user preferences', { userId });

    const result = await userPreferencesService.getPreferences(userId as UserId);

    if (!isOk(result)) {
      return res.status((result.error as any).statusCode || 500).json({
        success: false,
        error: {
          code: isErr(result) ? (result.error as any).code : "UNKNOWN_ERROR",
          message: (isErr(result) ? (result.error as any).message : "An error occurred"),
        },
      });
    }

    res.json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    requestLogger.error('Unexpected error fetching preferences', { error });
    next(error);
  }
});

/**
 * Update user preferences
 * PATCH /api/v1/preferences
 */
router.patch('/', async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(uuidv4());
  
  try {
    const userId = getSessionData(req)?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    // Validate request body
    const validationResult = zodToResult(UserPreferencesUpdateSchema.safeParse(req.body));
    if (isErr(validationResult)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid preference data',
          details: isErr(validationResult) && validationResult.error.details && typeof validationResult.error.details === 'object' && 'errors' in validationResult.error.details ? (validationResult.error.details as any).errors || [] : [],
        },
      });
    }

    requestLogger.info('Updating user preferences', { 
      userId,
      sections: Object.keys(validationResult.value),
    });

    const result = await userPreferencesService.updatePreferences(
      userId as UserId,
      validationResult.value
    );

    if (!isOk(result)) {
      return res.status((result.error as any).statusCode || 500).json({
        success: false,
        error: {
          code: isErr(result) ? (result.error as any).code : "UNKNOWN_ERROR",
          message: (isErr(result) ? (result.error as any).message : "An error occurred"),
        },
      });
    }

    requestLogger.info('User preferences updated successfully', { userId });

    res.json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    requestLogger.error('Unexpected error updating preferences', { error });
    next(error);
  }
});

/**
 * Reset preferences to defaults
 * POST /api/v1/preferences/reset
 */
router.post('/reset', async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(uuidv4());
  
  try {
    const userId = getSessionData(req)?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    requestLogger.info('Resetting user preferences to defaults', { userId });

    const result = await userPreferencesService.resetPreferences(userId as UserId);

    if (!isOk(result)) {
      return res.status((result.error as any).statusCode || 500).json({
        success: false,
        error: {
          code: isErr(result) ? (result.error as any).code : "UNKNOWN_ERROR",
          message: (isErr(result) ? (result.error as any).message : "An error occurred"),
        },
      });
    }

    requestLogger.info('User preferences reset successfully', { userId });

    res.json({
      success: true,
      data: result.value,
      message: 'Preferences have been reset to defaults',
    });
  } catch (error) {
    requestLogger.error('Unexpected error resetting preferences', { error });
    next(error);
  }
});

/**
 * Get specific preference section
 * GET /api/v1/preferences/:section
 */
router.get('/:section', async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(uuidv4());
  
  try {
    const userId = getSessionData(req)?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    const section = req.params.section;
    if (!['notifications', 'search', 'display'].includes(section)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SECTION',
          message: 'Invalid preference section. Must be one of: notifications, search, display',
        },
      });
    }

    requestLogger.info('Fetching specific preference section', { userId, section });

    const result = await userPreferencesService.getPreferences(userId as UserId);

    if (!isOk(result)) {
      return res.status((result.error as any).statusCode || 500).json({
        success: false,
        error: {
          code: isErr(result) ? (result.error as any).code : "UNKNOWN_ERROR",
          message: (isErr(result) ? (result.error as any).message : "An error occurred"),
        },
      });
    }

    res.json({
      success: true,
      data: result.value[section as keyof typeof result.value],
    });
  } catch (error) {
    requestLogger.error('Unexpected error fetching preference section', { error });
    next(error);
  }
});

/**
 * Update specific preference section
 * PATCH /api/v1/preferences/:section
 */
router.patch('/:section', async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(uuidv4());
  
  try {
    const userId = getSessionData(req)?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    const section = req.params.section;
    if (!['notifications', 'search', 'display'].includes(section)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SECTION',
          message: 'Invalid preference section. Must be one of: notifications, search, display',
        },
      });
    }

    // Wrap the section data in an object for validation
    const updateData = { [section]: req.body };
    const validationResult = zodToResult(UserPreferencesUpdateSchema.safeParse(updateData));
    if (isErr(validationResult)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid preference data',
          details: isErr(validationResult) && validationResult.error.details && typeof validationResult.error.details === 'object' && 'errors' in validationResult.error.details ? (validationResult.error.details as any).errors || [] : [],
        },
      });
    }

    requestLogger.info('Updating specific preference section', { userId, section });

    const result = await userPreferencesService.updatePreferences(
      userId as UserId,
      validationResult.value
    );

    if (!isOk(result)) {
      return res.status((result.error as any).statusCode || 500).json({
        success: false,
        error: {
          code: isErr(result) ? (result.error as any).code : "UNKNOWN_ERROR",
          message: (isErr(result) ? (result.error as any).message : "An error occurred"),
        },
      });
    }

    requestLogger.info('Preference section updated successfully', { userId, section });

    res.json({
      success: true,
      data: result.value[section as keyof typeof result.value],
    });
  } catch (error) {
    requestLogger.error('Unexpected error updating preference section', { error });
    next(error);
  }
});

export default router;