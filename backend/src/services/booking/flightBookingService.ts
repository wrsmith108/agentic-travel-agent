/**
 * Flight Booking Service
 * Handles the complete flight booking workflow including validation,
 * price confirmation, booking creation, and payment processing
 */

import { v4 as uuidv4 } from 'uuid';
import { createTimestamp } from '@/services/auth/functional/types';
import { Result, ok, err } from '../../utils/resultString';
import { isOk, isErr } from '../../utils/resultString';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import createLogger from '../../utils/logger';
import { getRedisClient } from '../redis/redisClient';
import { enhancedAmadeusService } from '../flights/enhancedAmadeusService';
import { emailService } from '../notifications/emailService';
import { metricsService } from '../monitoring/metricsService';
import { env } from '../../config/env';
import {
  BookingRequest,
  BookingConfirmation,
  BookingStatus,
  BookingListItem,
  BookingSearchFilters,
  BookingModification,
  BookingCancellation,
  PriceBreakdown,
  validateBookingRequest,
} from '../../schemas/booking';
import { FlightOffer } from '../../schemas/flight';
import { UserId } from '../../types/brandedTypes';
import { Result, ok, err, isOk, isErr } from '@/utils/resultString';

const logger = createLogger('FlightBookingService');

interface BookingData extends BookingConfirmation {
  userId: string;
  offerId: string;
  paymentIntentId?: string;
  metadata?: Record<string, any>;
}

interface BookingPriceConfirmation {
  isValid: boolean;
  currentPrice?: PriceBreakdown;
  originalPrice: PriceBreakdown;
  priceDifference?: number;
  expiresAt: Date;
}

export class FlightBookingService {
  private redisClient: ReturnType<typeof getRedisClient>;
  private bookingTTL: number = 30 * 24 * 60 * 60; // 30 days
  private priceLockDuration: number = 15 * 60; // 15 minutes

  constructor() {
    this.redisClient = getRedisClient();
  }

  /**
   * Create a new flight booking
   */
  async createBooking(
    userId: UserId,
    bookingRequest: BookingRequest
  ): Promise<Result<BookingConfirmation, AppError>> {
    try {
      logger.info('Creating flight booking', {
        userId,
        offerId: bookingRequest.offerId,
        passengerCount: bookingRequest.passengers.length,
      });

      // Step 1: Validate booking request
      const validatedRequest = validateBookingRequest(bookingRequest);

      // Step 2: Retrieve and validate flight offer
      const offerResult = await this.getFlightOffer(validatedRequest.offerId);
      if (!isOk(offerResult)) {
        return err((isErr(offerResult) ? offerResult.error : undefined));
      }
      const flightOffer = isOk(offerResult) ? offerResult.value : null;

      // Step 3: Confirm current price and availability
      const priceConfirmation = await this.confirmPriceAndAvailability(
        flightOffer,
        validatedRequest.passengers.length
      );
      if (!priceConfirmation.isValid) {
        return err(new AppError(
          409,
          'Flight price or availability has changed',
          ErrorCodes.CONFLICT,
          { priceConfirmation }
        ));
      }

      // Step 4: Lock the price for booking duration
      const priceLockResult = await this.lockPrice(
        validatedRequest.offerId,
        priceConfirmation.currentPrice!
      );
      if (!isOk(priceLockResult)) {
        logger.warn('Failed to lock price', { error: (isErr(priceLockResult) ? priceLockResult.error : undefined) });
      }

      // Step 5: Create booking with Amadeus
      const amadeusBookingResult = await this.createAmadeusBooking(
        flightOffer,
        validatedRequest
      );
      if (!isOk(amadeusBookingResult)) {
        return err((isErr(amadeusBookingResult) ? amadeusBookingResult.error : undefined));
      }

      // Step 6: Process payment (simplified for MVP)
      const paymentResult = await this.processPayment(
        validatedRequest.paymentInfo,
        priceConfirmation.currentPrice!
      );
      if (!isOk(paymentResult)) {
        // Rollback booking if payment fails
        await this.cancelAmadeusBooking((isOk(amadeusBookingResult) ? amadeusBookingResult.value : undefined).pnr);
        return err((isErr(paymentResult) ? paymentResult.error : undefined));
      }

      // Step 7: Create booking confirmation
      const bookingId = uuidv4();
      const bookingConfirmation: BookingConfirmation = {
        bookingId,
        pnr: (isOk(amadeusBookingResult) ? amadeusBookingResult.value : undefined).pnr,
        status: 'CONFIRMED',
        flightOffer,
        passengers: validatedRequest.passengers,
        contactInfo: validatedRequest.contactInfo,
        priceBreakdown: priceConfirmation.currentPrice!,
        paymentStatus: 'AUTHORIZED',
        createdAt: createTimestamp(),
        ticketingDeadline: this.calculateTicketingDeadline(flightOffer),
      };

      // Step 8: Store booking data
      const bookingData: BookingData = {
        ...bookingConfirmation,
        userId,
        offerId: validatedRequest.offerId,
        paymentIntentId: (isOk(paymentResult) ? paymentResult.value : undefined).paymentIntentId,
      };

      await this.storeBooking(bookingId, bookingData);

      // Step 9: Send confirmation email
      await this.sendBookingConfirmation(bookingData);

      // Step 10: Record metrics
      metricsService.incrementCounter('bookings.created', {
        origin: flightOffer.itineraries[0].segments[0].departure.iataCode,
        destination: flightOffer.itineraries[0].segments[
          flightOffer.itineraries[0].segments.length - 1
        ].arrival.iataCode,
      });

      logger.info('Booking created successfully', {
        bookingId,
        pnr: bookingConfirmation.pnr,
        userId,
      });

      return ok(bookingConfirmation);
    } catch (error) {
      logger.error('Failed to create booking', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return err(new AppError(500, 'Booking creation failed', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Get booking by ID
   */
  async getBooking(
    userId: UserId,
    bookingId: string
  ): Promise<Result<BookingConfirmation, AppError>> {
    try {
      const key = `booking:${bookingId}`;
      const resultString = await this.redisClient.get(key);
    const resultString = result.value ? result.value.toString() : null

      if (!isOk(resultString) || isErr(resultString)) {
        return err(new AppError(404, 'Booking not found', ErrorCodes.NOT_FOUND));
      }

      const bookingData: BookingData = JSON.parse(result.value);

      // Verify user owns this booking
      if (bookingData.userId !== userId) {
        return err(new AppError(403, 'Access denied', ErrorCodes.FORBIDDEN));
      }

      // Remove internal data before returning
      const { userId: _, paymentIntentId, metadata, ...bookingConfirmation } = bookingData;

      return ok(bookingConfirmation);
    } catch (error) {
      logger.error('Failed to get booking', {
        error: error instanceof Error ? error.message : 'Unknown error',
        bookingId,
      });
      return err(new AppError(500, 'Failed to retrieve booking', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Get user's bookings
   */
  async getUserBookings(
    userId: UserId,
    filters?: BookingSearchFilters
  ): Promise<Result<BookingListItem[], AppError>> {
    try {
      const pattern = `booking:*`;
      const keysResultResult = await this.redisClient.keys(pattern);
    const keysResult = isOk(keysResultResult) ? keysResultResult.value.map(k => k.toString()) : []

      if (!isOk(keysResult)) {
        return err(new AppError(500, 'Failed to fetch bookings', ErrorCodes.SERVICE_ERROR));
      }

      const bookings: BookingListItem[] = [];

      // Fetch all bookings for user
      for (const key of (isOk(keysResult) ? keysResult.value : undefined)) {
        const resultString = await this.redisClient.get(key);
        if (isOk(resultString) && result.value) {
          const bookingData: BookingData = JSON.parse(result.value);
          
          if (bookingData.userId === userId) {
            // Apply filters
            if (filters?.status && bookingData.status !== filters.status) continue;
            if (filters?.fromDate && new Date(bookingData.createdAt) < new Date(filters.fromDate)) continue;
            if (filters?.toDate && new Date(bookingData.createdAt) > new Date(filters.toDate)) continue;
            if (filters?.pnr && bookingData.pnr !== filters.pnr) continue;

            const listItem: BookingListItem = {
              bookingId: bookingData.bookingId,
              pnr: bookingData.pnr,
              status: bookingData.status,
              origin: bookingData.flightOffer.itineraries[0].segments[0].departure.iataCode,
              destination: bookingData.flightOffer.itineraries[0].segments[
                bookingData.flightOffer.itineraries[0].segments.length - 1
              ].arrival.iataCode,
              departureDate: bookingData.flightOffer.itineraries[0].segments[0].departure.at,
              returnDate: bookingData.flightOffer.itineraries[1]?.segments[0].departure.at,
              passengerCount: bookingData.passengers.length,
              totalPrice: bookingData.priceBreakdown.grandTotal,
              currency: bookingData.priceBreakdown.currency,
              createdAt: bookingData.createdAt,
            };

            bookings.push(listItem);
          }
        }
      }

      // Sort by creation date (newest first)
      bookings.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Apply pagination
      const start = filters?.offset || 0;
      const limit = filters?.limit || 20;
      const paginatedBookings = bookings.slice(start, start + limit);

      return ok(paginatedBookings);
    } catch (error) {
      logger.error('Failed to get user bookings', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return err(new AppError(500, 'Failed to retrieve bookings', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(
    userId: UserId,
    cancellationRequest: BookingCancellation
  ): Promise<Result<BookingConfirmation, AppError>> {
    try {
      logger.info('Cancelling booking', {
        bookingId: cancellationRequest.bookingId,
        userId,
      });

      // Get booking
      const bookingResult = await this.getBooking(userId, cancellationRequest.bookingId);
      if (!isOk(bookingResult)) {
        return err((isErr(bookingResult) ? bookingResult.error : undefined));
      }

      const booking = isOk(bookingResult) ? bookingResult.value : null;

      // Check if booking can be cancelled
      if (booking.status === 'CANCELLED' || booking.status === 'REFUNDED') {
        return err(new AppError(
          400,
          'Booking is already cancelled',
          ErrorCodes.VALIDATION_ERROR
        ));
      }

      // Cancel with Amadeus
      const amadeusCancelResult = await this.cancelAmadeusBooking(booking.pnr);
      if (!isOk(amadeusCancelResult)) {
        logger.warn('Failed to cancel with Amadeus', { 
          error: (isErr(amadeusCancelResult) ? amadeusCancelResult.error : undefined),
          pnr: booking.pnr,
        });
      }

      // Process refund if requested
      if (cancellationRequest.requestRefund) {
        const refundResult = await this.processRefund(
          cancellationRequest.bookingId,
          booking.priceBreakdown
        );
        if (!isOk(refundResult)) {
          logger.warn('Refund processing failed', { 
            error: (isErr(refundResult) ? refundResult.error : undefined),
            bookingId: cancellationRequest.bookingId,
          });
        }
      }

      // Update booking status
      const updatedBooking: BookingConfirmation = {
        ...booking,
        status: 'CANCELLED',
        paymentStatus: cancellationRequest.requestRefund ? 'REFUNDED' : 'CAPTURED',
      };

      // Update stored booking
      const key = `booking:${cancellationRequest.bookingId}`;
      const storedResult = await this.redisClient.get(key);
      if (isOk(storedResult) && storedResult.value) {
        const bookingData: BookingData = JSON.parse(storedResult.value);
        bookingData.status = 'CANCELLED';
        await this.redisClient.set(key, JSON.stringify(bookingData), this.bookingTTL);
      }

      // Send cancellation email
      await this.sendCancellationConfirmation(updatedBooking, cancellationRequest.reason);

      // Record metrics
      metricsService.incrementCounter('bookings.cancelled', {
        refundRequested: cancellationRequest.requestRefund.toString(),
      });

      logger.info('Booking cancelled successfully', {
        bookingId: cancellationRequest.bookingId,
        refundRequested: cancellationRequest.requestRefund,
      });

      return ok(updatedBooking);
    } catch (error) {
      logger.error('Failed to cancel booking', {
        error: error instanceof Error ? error.message : 'Unknown error',
        bookingId: cancellationRequest.bookingId,
      });
      return err(new AppError(500, 'Booking cancellation failed', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Get flight offer from cache
   */
  private async getFlightOffer(offerId: string): Promise<Result<FlightOffer, AppError>> {
    const key = `flight-offer:${offerId}`;
    const resultString = await this.redisClient.get(key);

    if (!isOk(resultString) || isErr(resultString)) {
      return err(new AppError(404, 'Flight offer not found or expired', ErrorCodes.NOT_FOUND));
    }

    try {
      const flightOffer: FlightOffer = JSON.parse(result.value);
      return ok(flightOffer);
    } catch (error) {
      return err(new AppError(500, 'Invalid flight offer data', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Confirm price and availability with Amadeus
   */
  private async confirmPriceAndAvailability(
    flightOffer: FlightOffer,
    passengerCount: number
  ): Promise<BookingPriceConfirmation> {
    try {
      const resultString = await enhancedAmadeusService.confirmPrice([flightOffer]);
      
      if (!isOk(resultString) || result.value.length === 0) {
        return {
          isValid: false,
          originalPrice: this.extractPriceBreakdown(flightOffer),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        };
      }

      const confirmedOffer = isOk(resultString) ? result.value : null[0];
      const originalPrice = this.extractPriceBreakdown(flightOffer);
      const currentPrice = this.extractPriceBreakdown(confirmedOffer);

      const priceDifference = currentPrice.grandTotal - originalPrice.grandTotal;
      const priceChangeThreshold = originalPrice.grandTotal * 0.10; // 10% threshold

      return {
        isValid: Math.abs(priceDifference) <= priceChangeThreshold,
        currentPrice,
        originalPrice,
        priceDifference,
        expiresAt: new Date(Date.now() + this.priceLockDuration * 1000),
      };
    } catch (error) {
      logger.error('Price confirmation failed', { error });
      return {
        isValid: false,
        originalPrice: this.extractPriceBreakdown(flightOffer),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    }
  }

  /**
   * Extract price breakdown from flight offer
   */
  private extractPriceBreakdown(flightOffer: FlightOffer): PriceBreakdown {
    const price = flightOffer.price;
    return {
      baseFare: parseFloat(price.base || price.total),
      taxes: price.fees?.filter(fee => fee.type === 'TAX').map(fee => ({
        code: fee.type,
        description: fee.type,
        amount: parseFloat(fee.amount),
      })) || [],
      fees: price.fees?.filter(fee => fee.type !== 'TAX').map(fee => ({
        type: fee.type,
        description: fee.type,
        amount: parseFloat(fee.amount),
      })) || [],
      discount: 0,
      grandTotal: parseFloat(price.grandTotal),
      currency: price.currency,
    };
  }

  /**
   * Lock price for booking duration
   */
  private async lockPrice(
    offerId: string,
    price: PriceBreakdown
  ): Promise<Result<void, AppError>> {
    const key = `price-lock:${offerId}`;
    return await this.redisClient.set(
      key,
      JSON.stringify(price),
      this.priceLockDuration
    );
  }

  /**
   * Create booking with Amadeus API
   */
  private async createAmadeusBooking(
    flightOffer: FlightOffer,
    bookingRequest: BookingRequest
  ): Promise<Result<{ pnr: string; amadeusBookingId: string }, AppError>> {
    try {
      // In production, this would call Amadeus Flight Create Orders API
      // For MVP, we'll simulate the booking
      const pnr = this.generatePNR();
      const amadeusBookingId = `AMADEUS-${uuidv4()}`;

      logger.info('Created Amadeus booking (simulated)', {
        pnr,
        amadeusBookingId,
      });

      return ok({ pnr, amadeusBookingId });
    } catch (error) {
      logger.error('Amadeus booking failed', { error });
      return err(new AppError(500, 'Failed to create booking with airline', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Cancel booking with Amadeus
   */
  private async cancelAmadeusBooking(pnr: string): Promise<Result<void, AppError>> {
    try {
      // In production, this would call Amadeus cancellation API
      logger.info('Cancelled Amadeus booking (simulated)', { pnr });
      return ok(undefined);
    } catch (error) {
      logger.error('Amadeus cancellation failed', { error });
      return err(new AppError(500, 'Failed to cancel with airline', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Process payment (simplified for MVP)
   */
  private async processPayment(
    paymentInfo: any,
    priceBreakdown: PriceBreakdown
  ): Promise<Result<{ paymentIntentId: string; status: string }, AppError>> {
    try {
      // In production, this would integrate with Stripe/PayPal
      const paymentIntentId = `pi_${uuidv4()}`;

      logger.info('Payment processed (simulated)', {
        paymentIntentId,
        amount: priceBreakdown.grandTotal,
        currency: priceBreakdown.currency,
      });

      return ok({ paymentIntentId, status: 'authorized' });
    } catch (error) {
      logger.error('Payment processing failed', { error });
      return err(new AppError(500, 'Payment processing failed', ErrorCodes.PAYMENT_ERROR));
    }
  }

  /**
   * Process refund
   */
  private async processRefund(
    bookingId: string,
    priceBreakdown: PriceBreakdown
  ): Promise<Result<{ refundId: string }, AppError>> {
    try {
      // In production, this would process actual refund
      const refundId = `refund_${uuidv4()}`;

      logger.info('Refund processed (simulated)', {
        bookingId,
        refundId,
        amount: priceBreakdown.grandTotal,
        currency: priceBreakdown.currency,
      });

      return ok({ refundId });
    } catch (error) {
      logger.error('Refund processing failed', { error });
      return err(new AppError(500, 'Refund processing failed', ErrorCodes.PAYMENT_ERROR));
    }
  }

  /**
   * Store booking data
   */
  private async storeBooking(bookingId: string, bookingData: BookingData): Promise<void> {
    const key = `booking:${bookingId}`;
    const userBookingsKey = `user-bookings:${bookingData.userId}`;

    // Store booking
    await this.redisClient.set(key, JSON.stringify(bookingData), this.bookingTTL);

    // Add to user's booking list
    const existingResult = await this.redisClient.get(userBookingsKey);
    const bookingIds = isOk(existingResult) ? JSON.parse(existingResult.value) : [];
    
    bookingIds.push(bookingId);
    await this.redisClient.set(userBookingsKey, JSON.stringify(bookingIds), this.bookingTTL);
  }

  /**
   * Send booking confirmation email
   */
  private async sendBookingConfirmation(booking: BookingData): Promise<void> {
    try {
      const subject = `✈️ Booking Confirmation - ${booking.pnr}`;
      const body = this.generateBookingConfirmationEmail(booking);

      await emailService.sendEmail({
        to: booking.contactInfo.email,
        subject,
        html: body,
        priority: 'high',
      });
    } catch (error) {
      logger.error('Failed to send booking confirmation', { error });
      // Don't fail the booking if email fails
    }
  }

  /**
   * Send cancellation confirmation email
   */
  private async sendCancellationConfirmation(
    booking: BookingConfirmation,
    reason: string
  ): Promise<void> {
    try {
      const subject = `❌ Booking Cancellation - ${booking.pnr}`;
      const body = this.generateCancellationEmail(booking, reason);

      await emailService.sendEmail({
        to: booking.contactInfo.email,
        subject,
        html: body,
        priority: 'high',
      });
    } catch (error) {
      logger.error('Failed to send cancellation confirmation', { error });
    }
  }

  /**
   * Generate booking confirmation email HTML
   */
  private generateBookingConfirmationEmail(booking: BookingData): string {
    const departure = booking.flightOffer.itineraries[0].segments[0];
    const arrival = booking.flightOffer.itineraries[0].segments[
      booking.flightOffer.itineraries[0].segments.length - 1
    ];

    return `
      <h2>✈️ Your Flight Booking is Confirmed!</h2>
      
      <h3>Booking Reference: ${booking.pnr}</h3>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4>Flight Details</h4>
        <p><strong>Route:</strong> ${departure.departure.iataCode} → ${arrival.arrival.iataCode}</p>
        <p><strong>Departure:</strong> ${new Date(departure.departure.at).toLocaleString()}</p>
        <p><strong>Airline:</strong> ${departure.carrierCode}</p>
        <p><strong>Flight Number:</strong> ${departure.carrierCode}${departure.number}</p>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4>Passengers</h4>
        ${booking.passengers.map(p => `
          <p>${p.title} ${p.firstName} ${p.lastName}</p>
        `).join('')}
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4>Price Summary</h4>
        <p><strong>Total:</strong> ${booking.priceBreakdown.currency} ${booking.priceBreakdown.grandTotal.toFixed(2)}</p>
      </div>
      
      <p><strong>Important:</strong> Please arrive at the airport at least 2 hours before departure for domestic flights and 3 hours for international flights.</p>
      
      <p>If you need to make changes or cancel your booking, please visit our website or contact our support team.</p>
      
      <p>Thank you for choosing our service!</p>
    `;
  }

  /**
   * Generate cancellation email HTML
   */
  private generateCancellationEmail(booking: BookingConfirmation, reason: string): string {
    return `
      <h2>❌ Booking Cancellation Confirmation</h2>
      
      <p>Your booking has been successfully cancelled.</p>
      
      <h3>Cancellation Details</h3>
      <p><strong>Booking Reference:</strong> ${booking.pnr}</p>
      <p><strong>Cancellation Reason:</strong> ${reason}</p>
      <p><strong>Status:</strong> ${booking.status}</p>
      
      ${booking.paymentStatus === 'REFUNDED' ? `
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4>Refund Information</h4>
          <p>Your refund has been initiated and should be reflected in your account within 5-10 business days.</p>
          <p><strong>Refund Amount:</strong> ${booking.priceBreakdown.currency} ${booking.priceBreakdown.grandTotal.toFixed(2)}</p>
        </div>
      ` : ''}
      
      <p>If you have any questions about this cancellation, please contact our support team.</p>
      
      <p>We hope to serve you again in the future!</p>
    `;
  }

  /**
   * Generate PNR (Passenger Name Record)
   */
  private generatePNR(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pnr = '';
    for (let i = 0; i < 6; i++) {
      pnr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pnr;
  }

  /**
   * Calculate ticketing deadline
   */
  private calculateTicketingDeadline(flightOffer: FlightOffer): string {
    const departure = new Date(flightOffer.itineraries[0].segments[0].departure.at);
    const now = new Date();
    const hoursUntilDeparture = (departure.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Ticketing deadline logic:
    // - If departure > 7 days: 72 hours from booking
    // - If departure 3-7 days: 24 hours from booking
    // - If departure < 3 days: 2 hours from booking
    let deadlineHours = 72;
    if (hoursUntilDeparture < 72) {
      deadlineHours = 2;
    } else if (hoursUntilDeparture < 168) {
      deadlineHours = 24;
    }

    const deadline = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);
    return deadline as string;
  }
}

// Export singleton instance
export const flightBookingService = new FlightBookingService();