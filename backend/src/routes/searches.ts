/**
 * Saved searches routes
 * REST API endpoints for saved search management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '@/middleware/auth';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { flightSearchService } from '@/services/flights/flightSearchService';
import { createRequestLogger } from '@/utils/logger';
import { isOk, isErr } from '@/utils/result';
import {
  FlightSearchQuerySchema,
  AdvancedSearchOptionsSchema,
} from '@/schemas/flight';
import {
  CreateSavedSearchData,
  UpdateSavedSearchData,
} from '@/models/flight';

const router = Router();

/**
 * GET /api/v1/searches
 * Get user's saved searches
 */
router.get('/', requireAuth(), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    // Extract userId from JWT payload
    if (!req.jwtPayload || !req.jwtPayload.sub) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }
    
    const userId = req.jwtPayload.sub;
    
    requestLogger.info('Get saved searches request', { userId });

    const result = await flightSearchService.getSavedSearches(userId);

    if (!isOk(result)) {
      requestLogger.warn('Get saved searches failed', {
        error: result.error,
        userId,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : "An error occurred"),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/searches
 * Create a saved search
 */
router.post('/', requireAuth(), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    // Extract userId from JWT payload
    if (!req.jwtPayload || !req.jwtPayload.sub) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }
    
    const userId = req.jwtPayload.sub;
    
    requestLogger.info('Create saved search request', {
      userId,
      name: req.body.name,
    });

    // Validate saved search data
    console.log('Received saved search request:', JSON.stringify(req.body, null, 2));
    
    let searchQuery;
    try {
      searchQuery = FlightSearchQuerySchema.parse(req.body.searchQuery);
    } catch (zodError) {
      console.error('FlightSearchQuerySchema validation error:', zodError);
      res.status(400).json({
        error: 'Validation failed',
        details: zodError instanceof Error ? zodError.message : 'Unknown validation error'
      });
      return;
    }
    
    const createData: CreateSavedSearchData = {
      userId,
      name: req.body.name,
      searchQuery,
      advancedOptions: req.body.advancedOptions
        ? AdvancedSearchOptionsSchema.parse(req.body.advancedOptions)
        : undefined,
      priceAlerts: req.body.priceAlerts,
      frequency: req.body.frequency,
      expiresAt: req.body.expiresAt,
    };

    const result = await flightSearchService.createSavedSearch(createData);

    if (!isOk(result)) {
      requestLogger.warn('Create saved search failed', {
        error: result.error,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : "An error occurred"),
        },
      });
      return;
    }

    requestLogger.info('Saved search created', {
      savedSearchId: result.value.id,
    });

    res.status(201).json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid saved search data',
          details: error.errors,
        },
      });
      return;
    }

    next(error);
  }
});

/**
 * PUT /api/v1/searches/:id
 * Update a saved search
 */
router.put('/:id', requireAuth(), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    // Extract userId from JWT payload
    if (!req.jwtPayload || !req.jwtPayload.sub) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }
    
    const userId = req.jwtPayload.sub;
    const searchId = req.params.id;
    
    requestLogger.info('Update saved search request', {
      userId,
      searchId,
    });

    const updateData: UpdateSavedSearchData = {
      name: req.body.name,
      searchQuery: req.body.searchQuery 
        ? FlightSearchQuerySchema.parse(req.body.searchQuery)
        : undefined,
      advancedOptions: req.body.advancedOptions,
      priceAlerts: req.body.priceAlerts,
      frequency: req.body.frequency,
      expiresAt: req.body.expiresAt,
      isActive: req.body.isActive,
    };

    const result = await flightSearchService.updateSavedSearch(userId, searchId, updateData);

    if (!isOk(result)) {
      requestLogger.warn('Update saved search failed', {
        error: result.error,
        searchId,
      });

      res.status((isErr(result) ? result.error.code : "") === 'NOT_FOUND' ? 404 : 400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : "An error occurred"),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid update data',
          details: error.errors,
        },
      });
      return;
    }

    next(error);
  }
});

/**
 * DELETE /api/v1/searches/:id
 * Delete a saved search
 */
router.delete('/:id', requireAuth(), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    // Extract userId from JWT payload
    if (!req.jwtPayload || !req.jwtPayload.sub) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }
    
    const userId = req.jwtPayload.sub;
    const searchId = req.params.id;
    
    requestLogger.info('Delete saved search request', {
      userId,
      searchId,
    });

    const result = await flightSearchService.deleteSavedSearch(userId, searchId);

    if (!isOk(result)) {
      requestLogger.warn('Delete saved search failed', {
        error: result.error,
        searchId,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : "An error occurred"),
        },
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/searches/check-prices
 * Check prices for all saved searches
 */
router.post('/check-prices', requireAuth(), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    // Extract userId from JWT payload
    if (!req.jwtPayload || !req.jwtPayload.sub) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }
    
    const userId = req.jwtPayload.sub;
    
    requestLogger.info('Check saved search prices request', { userId });

    const result = await flightSearchService.checkSavedSearchPrices(userId);

    if (!isOk(result)) {
      requestLogger.warn('Check prices failed', {
        error: result.error,
        userId,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : "An error occurred"),
        },
      });
      return;
    }

    requestLogger.info('Price check completed', {
      searchesChecked: (result.value as any).length,
      alertsGenerated: result.value.filter(r => r.alert).length,
    });

    res.status(200).json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/searches/history
 * Get user's search history
 */
router.get('/history', requireAuth(), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    // Extract userId from JWT payload
    if (!req.jwtPayload || !req.jwtPayload.sub) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }
    
    const userId = req.jwtPayload.sub;
    
    requestLogger.info('Get search history request', { userId });

    const result = await flightSearchService.getSearchHistory(userId);

    if (isErr(result)) {
      throw result.error;
    }

    requestLogger.info('Search history retrieved successfully', { 
      userId,
      historyCount: result.value.length 
    });

    res.json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/searches/history
 * Clear user's search history
 */
router.delete('/history', requireAuth(), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    // Extract userId from JWT payload
    if (!req.jwtPayload || !req.jwtPayload.sub) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }
    
    const userId = req.jwtPayload.sub;
    
    requestLogger.info('Clear search history request', { userId });

    const result = await flightSearchService.clearSearchHistory(userId);

    if (isErr(result)) {
      throw result.error;
    }

    requestLogger.info('Search history cleared successfully', { userId });

    res.json({
      success: true,
      message: 'Search history cleared successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;