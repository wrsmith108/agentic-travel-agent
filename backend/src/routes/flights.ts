/**
 * Flight routes
 * REST API endpoints for flight search and management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, attachSessionInfo, getSessionData } from '@/middleware/session';
import { flightSearchService } from '@/services/flights/flightSearchService';
import { enhancedAmadeusService } from '@/services/flights/enhancedAmadeusService';
import { conversationalSearchService } from '@/services/ai/conversationalSearchService';
import { createRequestLogger } from '@/utils/logger';
import { isOk, isErr } from '@/utils/result';
import {
  FlightSearchQuerySchema,
  AdvancedSearchOptionsSchema,
  NaturalLanguageSearchSchema,
  SavedSearchSchema,
} from '@/schemas/flight';
import {
  CreateSavedSearchData,
  UpdateSavedSearchData,
} from '@/models/flight';

const router = Router();

// Apply session middleware to all routes
router.use(attachSessionInfo);

/**
 * POST /api/v1/flights/search
 * Search for flights
 */
router.post('/search', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    requestLogger.info('Flight search request', {
      userId: getSessionData(req)?.userId,
      query: req.body,
    });

    // Validate search query
    const searchQuery = FlightSearchQuerySchema.parse(req.body.query);
    const advancedOptions = req.body.advancedOptions 
      ? AdvancedSearchOptionsSchema.parse(req.body.advancedOptions)
      : undefined;

    // Get user preferences if authenticated
    let preferences;
    if (getSessionData(req)?.userId) {
      // TODO: Fetch user preferences from storage
    }

    // Perform search
    const result = await flightSearchService.searchFlights(
      searchQuery,
      getSessionData(req)?.userId,
      preferences,
      advancedOptions
    );

    if (!isOk(result)) {
      requestLogger.warn('Flight search failed', {
        error: result.error,
        query: searchQuery,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
        },
      });
      return;
    }

    requestLogger.info('Flight search successful', {
      resultCount: result.value.flights.length,
      analytics: result.value.analytics,
    });

    res.status(200).json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      requestLogger.warn('Flight search validation failed', {
        errors: error.errors,
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid search parameters',
          details: error.errors,
        },
      });
      return;
    }

    next(error);
  }
});

/**
 * POST /api/v1/flights/search/natural
 * Natural language flight search
 */
router.post('/search/natural', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    requestLogger.info('Natural language search request', {
      userId: getSessionData(req)?.userId,
      query: req.body.query,
    });

    // Validate natural language query
    const nlQuery = NaturalLanguageSearchSchema.parse(req.body);

    // Process query
    const result = await conversationalSearchService.processQuery(
      nlQuery,
      getSessionData(req)?.userId
    );

    if (!isOk(result)) {
      requestLogger.warn('Natural language search failed', {
        error: result.error,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
        },
      });
      return;
    }

    requestLogger.info('Natural language search successful', {
      sessionId: result.value.sessionId,
      hasResults: !isErr(result).searchResults,
    });

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
          message: 'Invalid query format',
          details: error.errors,
        },
      });
      return;
    }

    next(error);
  }
});

/**
 * GET /api/v1/flights/airports
 * Search airports by keyword
 */
router.get('/airports', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    const keyword = req.query.keyword as string;
    
    if (!keyword || keyword.length < 2) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Keyword must be at least 2 characters',
        },
      });
      return;
    }

    requestLogger.info('Airport search request', { keyword });

    const result = await enhancedAmadeusService.searchAirports(keyword);

    if (!isOk(result)) {
      requestLogger.warn('Airport search failed', {
        error: result.error,
        keyword,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
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
 * POST /api/v1/flights/price/confirm
 * Confirm flight price before booking
 */
router.post('/price/confirm', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    requestLogger.info('Price confirmation request', {
      userId: getSessionData(req)?.userId,
      flightOfferId: req.body.flightOffer?.id,
    });

    // Validate flight offer
    if (!req.body.flightOffer) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Flight offer is required',
        },
      });
      return;
    }

    const result = await enhancedAmadeusService.confirmPrice(req.body.flightOffer);

    if (!isOk(result)) {
      requestLogger.warn('Price confirmation failed', {
        error: result.error,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
        },
      });
      return;
    }

    requestLogger.info('Price confirmation successful', {
      confirmedPrice: result.value.price.grandTotal,
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
 * GET /api/v1/flights/saved
 * Get user's saved searches
 */
router.get('/saved', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    const userId = getSessionData(req)!.userId;
    
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
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
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
 * POST /api/v1/flights/saved
 * Create a saved search
 */
router.post('/saved', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    const userId = getSessionData(req)!.userId;
    
    requestLogger.info('Create saved search request', {
      userId,
      name: req.body.name,
    });

    // Validate saved search data
    const createData: CreateSavedSearchData = {
      userId,
      name: req.body.name,
      searchQuery: FlightSearchQuerySchema.parse(req.body.searchQuery),
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
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
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
 * PUT /api/v1/flights/saved/:id
 * Update a saved search
 */
router.put('/saved/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    const userId = getSessionData(req)!.userId;
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

      res.status((isErr(result) ? (isErr(result) ? result.error.code : "") : "") === 'NOT_FOUND' ? 404 : 400).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
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
 * DELETE /api/v1/flights/saved/:id
 * Delete a saved search
 */
router.delete('/saved/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    const userId = getSessionData(req)!.userId;
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
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
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
 * POST /api/v1/flights/saved/check-prices
 * Check prices for all saved searches
 */
router.post('/saved/check-prices', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    const userId = getSessionData(req)!.userId;
    
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
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
        },
      });
      return;
    }

    requestLogger.info('Price check completed', {
      searchesChecked: result.value.length,
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
 * GET /api/v1/flights/alerts
 * Get price alerts
 */
router.get('/alerts', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    const userId = getSessionData(req)!.userId;
    const unreadOnly = req.query.unread === 'true';
    
    requestLogger.info('Get price alerts request', {
      userId,
      unreadOnly,
    });

    const result = await flightSearchService.getPriceAlerts(userId, unreadOnly);

    if (!isOk(result)) {
      requestLogger.warn('Get price alerts failed', {
        error: result.error,
        userId,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
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
 * PUT /api/v1/flights/alerts/:id/read
 * Mark price alert as read
 */
router.put('/alerts/:id/read', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    const userId = getSessionData(req)!.userId;
    const alertId = req.params.id;
    
    requestLogger.info('Mark alert as read request', {
      userId,
      alertId,
    });

    const result = await flightSearchService.markAlertAsRead(userId, alertId);

    if (!isOk(result)) {
      requestLogger.warn('Mark alert as read failed', {
        error: result.error,
        alertId,
      });

      res.status((isErr(result) ? (isErr(result) ? result.error.code : "") : "") === 'NOT_FOUND' ? 404 : 400).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Alert marked as read',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/flights/book
 * Create flight booking
 */
router.post('/book', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    const userId = getSessionData(req)!.userId;
    
    requestLogger.info('Flight booking request', {
      userId,
      flightOfferId: req.body.flightOffer?.id,
      travelers: req.body.travelers?.length,
    });

    // Validate booking data
    if (!req.body.flightOffer || !req.body.travelers || req.body.travelers.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Flight offer and travelers information are required',
        },
      });
      return;
    }

    const result = await enhancedAmadeusService.createBooking(
      req.body.flightOffer,
      req.body.travelers
    );

    if (!isOk(result)) {
      requestLogger.warn('Flight booking failed', {
        error: result.error,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
        },
      });
      return;
    }

    requestLogger.info('Flight booking successful', {
      bookingReference: result.value.bookingReference,
    });

    res.status(201).json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    next(error);
  }
});

export default router;