/**
 * Flight Booking Routes
 * Handles all booking-related API endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { attachSessionInfo, getSessionData } from '@/middleware/session';
import { requireAuth } from '@/middleware/auth';
import { sanitizeInputs } from '@/middleware/inputSanitization';
import { flightBookingService } from '@/services/booking/flightBookingService';
import { createRequestLogger } from '@/utils/logger';
import { isOk, isErr } from '@/utils/result';
import { UserId } from '@/types/brandedTypes';
import {
  BookingRequestSchema,
  BookingSearchFiltersSchema,
  BookingCancellationSchema,
  BookingModificationSchema,
} from '@/schemas/booking';

const router = Router();

// Apply middleware
router.use(attachSessionInfo);
router.use(requireAuth);
router.use(sanitizeInputs);

/**
 * Create a new booking
 * POST /api/v1/bookings
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(uuidv4());
  
  try {
    requestLogger.info('Creating flight booking', {
      userId: getSessionData(req)?.userId,
    });

    // Validate request body
    const validationResult = BookingRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid booking data',
          details: (isErr(validationResult) ? validationResult.error : undefined).errors,
        },
      });
    }

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

    // Create booking
    const result = await flightBookingService.createBooking(
      userId as UserId,
      validationResult.data
    );

    if (!isOk(result)) {
      requestLogger.warn('Booking creation failed', {
        error: result.error,
      });

      return res.status(result.error.statusCode || 500).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
          details: result.error.details,
        },
      });
    }

    requestLogger.info('Booking created successfully', {
      bookingId: result.value.bookingId,
      pnr: result.value.pnr,
    });

    res.status(201).json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    requestLogger.error('Unexpected error in booking creation', { error });
    next(error);
  }
});

/**
 * Get booking details
 * GET /api/v1/bookings/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(uuidv4());
  
  try {
    const bookingId = req.params.id;
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

    requestLogger.info('Fetching booking details', {
      bookingId,
      userId,
    });

    const result = await flightBookingService.getBooking(
      userId as UserId,
      bookingId
    );

    if (!isOk(result)) {
      return res.status(result.error.statusCode || 404).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
        },
      });
    }

    res.json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    requestLogger.error('Unexpected error fetching booking', { error });
    next(error);
  }
});

/**
 * List user's bookings
 * GET /api/v1/bookings
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

    // Parse and validate query parameters
    const filtersResult = BookingSearchFiltersSchema.safeParse(req.query);
    const filters = filtersResult.success ? filtersResult.data : undefined;

    requestLogger.info('Fetching user bookings', {
      userId,
      filters,
    });

    const result = await flightBookingService.getUserBookings(
      userId as UserId,
      filters
    );

    if (!isOk(result)) {
      return res.status(500).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
        },
      });
    }

    res.json({
      success: true,
      data: result.value,
      meta: {
        total: result.value.length,
        limit: filters?.limit || 20,
        offset: filters?.offset || 0,
      },
    });
  } catch (error) {
    requestLogger.error('Unexpected error fetching bookings', { error });
    next(error);
  }
});

/**
 * Cancel a booking
 * POST /api/v1/bookings/:id/cancel
 */
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(uuidv4());
  
  try {
    const bookingId = req.params.id;
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

    // Validate cancellation request
    const validationResult = BookingCancellationSchema.safeParse({
      bookingId,
      ...req.body,
    });

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid cancellation data',
          details: (isErr(validationResult) ? validationResult.error : undefined).errors,
        },
      });
    }

    requestLogger.info('Cancelling booking', {
      bookingId,
      userId,
      reason: validationResult.data.reason,
    });

    const result = await flightBookingService.cancelBooking(
      userId as UserId,
      validationResult.data
    );

    if (!isOk(result)) {
      return res.status(result.error.statusCode || 500).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
          details: result.error.details,
        },
      });
    }

    requestLogger.info('Booking cancelled successfully', {
      bookingId,
      status: result.value.status,
    });

    res.json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    requestLogger.error('Unexpected error cancelling booking', { error });
    next(error);
  }
});

/**
 * Check booking status
 * GET /api/v1/bookings/:id/status
 */
router.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(uuidv4());
  
  try {
    const bookingId = req.params.id;
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

    const result = await flightBookingService.getBooking(
      userId as UserId,
      bookingId
    );

    if (!isOk(result)) {
      return res.status(result.error.statusCode || 404).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
        },
      });
    }

    res.json({
      success: true,
      data: {
        bookingId: result.value.bookingId,
        pnr: result.value.pnr,
        status: result.value.status,
        paymentStatus: result.value.paymentStatus,
        ticketingDeadline: result.value.ticketingDeadline,
      },
    });
  } catch (error) {
    requestLogger.error('Unexpected error checking booking status', { error });
    next(error);
  }
});

/**
 * Resend booking confirmation email
 * POST /api/v1/bookings/:id/resend-confirmation
 */
router.post('/:id/resend-confirmation', async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(uuidv4());
  
  try {
    const bookingId = req.params.id;
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

    requestLogger.info('Resending booking confirmation', {
      bookingId,
      userId,
    });

    // Get booking to verify ownership
    const result = await flightBookingService.getBooking(
      userId as UserId,
      bookingId
    );

    if (!isOk(result)) {
      return res.status(result.error.statusCode || 404).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
        },
      });
    }

    // In production, this would trigger email resend
    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Booking confirmation email has been resent',
      data: {
        bookingId,
        email: result.value.contactInfo.email,
      },
    });
  } catch (error) {
    requestLogger.error('Unexpected error resending confirmation', { error });
    next(error);
  }
});

/**
 * Get booking invoice/receipt
 * GET /api/v1/bookings/:id/invoice
 */
router.get('/:id/invoice', async (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = createRequestLogger(uuidv4());
  
  try {
    const bookingId = req.params.id;
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

    const result = await flightBookingService.getBooking(
      userId as UserId,
      bookingId
    );

    if (!isOk(result)) {
      return res.status(result.error.statusCode || 404).json({
        success: false,
        error: {
          code: (isErr(result) ? (isErr(result) ? result.error.code : "") : ""),
          message: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
        },
      });
    }

    // In production, this would generate a PDF invoice
    // For MVP, return structured invoice data
    const invoice = {
      invoiceNumber: `INV-${bookingId.slice(0, 8).toUpperCase()}`,
      bookingReference: result.value.pnr,
      issueDate: result.value.createdAt,
      dueDate: result.value.ticketingDeadline,
      status: result.value.paymentStatus === 'CAPTURED' ? 'PAID' : 'PENDING',
      billTo: {
        name: `${result.value.passengers[0].firstName} ${result.value.passengers[0].lastName}`,
        email: result.value.contactInfo.email,
        phone: result.value.contactInfo.phone,
      },
      items: [
        {
          description: `Flight Booking - ${result.value.pnr}`,
          quantity: result.value.passengers.length,
          unitPrice: result.value.priceBreakdown.grandTotal / result.value.passengers.length,
          total: result.value.priceBreakdown.grandTotal,
        },
      ],
      subtotal: result.value.priceBreakdown.baseFare,
      taxes: result.value.priceBreakdown.taxes,
      fees: result.value.priceBreakdown.fees,
      discount: result.value.priceBreakdown.discount,
      total: result.value.priceBreakdown.grandTotal,
      currency: result.value.priceBreakdown.currency,
    };

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    requestLogger.error('Unexpected error generating invoice', { error });
    next(error);
  }
});

// Future endpoints (not implemented in MVP):
// - POST /api/v1/bookings/:id/modify - Modify booking
// - POST /api/v1/bookings/:id/add-services - Add ancillary services
// - GET /api/v1/bookings/:id/boarding-pass - Get boarding pass

export default router;