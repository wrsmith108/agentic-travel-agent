/**
 * Booking schemas and types
 * Handles flight booking data validation
 */

import { z } from 'zod';

/**
 * Passenger type enum
 */
export const PassengerTypeSchema = z.enum(['ADULT', 'CHILD', 'INFANT']);

/**
 * Document type enum
 */
export const DocumentTypeSchema = z.enum(['PASSPORT', 'ID_CARD', 'DRIVER_LICENSE']);

/**
 * Gender enum
 */
export const GenderSchema = z.enum(['MALE', 'FEMALE', 'OTHER']);

/**
 * Passenger document schema
 */
export const PassengerDocumentSchema = z.object({
  documentType: DocumentTypeSchema,
  documentNumber: z.string().min(5).max(50),
  issuingCountry: z.string().length(2).toUpperCase(),
  expiryDate: z.string().datetime(),
  nationality: z.string().length(2).toUpperCase(),
});

/**
 * Passenger information schema
 */
export const PassengerSchema = z.object({
  id: z.string().uuid().optional(),
  type: PassengerTypeSchema,
  title: z.enum(['MR', 'MS', 'MRS', 'MISS', 'DR']),
  firstName: z.string().min(1).max(50).regex(/^[A-Za-z\s-']+$/),
  middleName: z.string().max(50).regex(/^[A-Za-z\s-']*$/).optional(),
  lastName: z.string().min(1).max(50).regex(/^[A-Za-z\s-']+$/),
  dateOfBirth: z.string().datetime(),
  gender: GenderSchema,
  document: PassengerDocumentSchema,
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  specialRequests: z.array(z.string()).optional(),
  mealPreference: z.string().optional(),
  seatPreference: z.enum(['WINDOW', 'AISLE', 'MIDDLE', 'ANY']).optional(),
});

/**
 * Contact information schema
 */
export const ContactInfoSchema = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  emergencyContact: z.object({
    name: z.string().min(1).max(100),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
    relationship: z.string().min(1).max(50),
  }).optional(),
});

/**
 * Payment method enum
 */
export const PaymentMethodSchema = z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER']);

/**
 * Payment information schema (simplified for MVP)
 */
export const PaymentInfoSchema = z.object({
  method: PaymentMethodSchema,
  // In production, card details would be tokenized
  cardToken: z.string().optional(),
  billingAddress: z.object({
    line1: z.string().min(1).max(100),
    line2: z.string().max(100).optional(),
    city: z.string().min(1).max(50),
    state: z.string().max(50).optional(),
    postalCode: z.string().min(1).max(20),
    country: z.string().length(2).toUpperCase(),
  }),
});

/**
 * Booking status enum
 */
export const BookingStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'TICKETED',
  'CANCELLED',
  'REFUNDED',
  'EXPIRED',
]);

/**
 * Price breakdown schema
 */
export const PriceBreakdownSchema = z.object({
  baseFare: z.number().positive(),
  taxes: z.array(z.object({
    code: z.string(),
    description: z.string(),
    amount: z.number(),
  })),
  fees: z.array(z.object({
    type: z.string(),
    description: z.string(),
    amount: z.number(),
  })),
  discount: z.number().min(0).default(0),
  grandTotal: z.number().positive(),
  currency: z.string().length(3).toUpperCase(),
});

/**
 * Flight booking request schema
 */
export const BookingRequestSchema = z.object({
  offerId: z.string(),
  passengers: z.array(PassengerSchema).min(1).max(9),
  contactInfo: ContactInfoSchema,
  paymentInfo: PaymentInfoSchema,
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms and conditions',
  }),
  subscribeToUpdates: z.boolean().default(false),
});

/**
 * Booking confirmation schema
 */
export const BookingConfirmationSchema = z.object({
  bookingId: z.string(),
  pnr: z.string(), // Passenger Name Record
  status: BookingStatusSchema,
  flightOffer: z.any(), // Reference to original flight offer
  passengers: z.array(PassengerSchema),
  contactInfo: ContactInfoSchema,
  priceBreakdown: PriceBreakdownSchema,
  paymentStatus: z.enum(['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED']),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  ticketingDeadline: z.string().datetime().optional(),
  eTickets: z.array(z.object({
    passengerId: z.string().uuid(),
    ticketNumber: z.string(),
    issuedAt: z.string().datetime(),
  })).optional(),
});

/**
 * Booking list item schema
 */
export const BookingListItemSchema = z.object({
  bookingId: z.string(),
  pnr: z.string(),
  status: BookingStatusSchema,
  origin: z.string(),
  destination: z.string(),
  departureDate: z.string().datetime(),
  returnDate: z.string().datetime().optional(),
  passengerCount: z.number().int().positive(),
  totalPrice: z.number().positive(),
  currency: z.string().length(3),
  createdAt: z.string().datetime(),
});

/**
 * Booking search filters
 */
export const BookingSearchFiltersSchema = z.object({
  status: BookingStatusSchema.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  pnr: z.string().optional(),
  passengerEmail: z.string().email().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

/**
 * Booking modification request
 */
export const BookingModificationSchema = z.object({
  bookingId: z.string(),
  modificationType: z.enum(['PASSENGER_INFO', 'CONTACT_INFO', 'SEAT_SELECTION', 'MEAL_PREFERENCE']),
  passengers: z.array(PassengerSchema).optional(),
  contactInfo: ContactInfoSchema.optional(),
  seatSelections: z.array(z.object({
    passengerId: z.string().uuid(),
    segmentId: z.string(),
    seatNumber: z.string(),
  })).optional(),
});

/**
 * Booking cancellation request
 */
export const BookingCancellationSchema = z.object({
  bookingId: z.string(),
  reason: z.string().min(1).max(500),
  requestRefund: z.boolean().default(true),
});

// TypeScript types
export type PassengerType = z.infer<typeof PassengerTypeSchema>;
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type Gender = z.infer<typeof GenderSchema>;
export type PassengerDocument = z.infer<typeof PassengerDocumentSchema>;
export type Passenger = z.infer<typeof PassengerSchema>;
export type ContactInfo = z.infer<typeof ContactInfoSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type PaymentInfo = z.infer<typeof PaymentInfoSchema>;
export type BookingStatus = z.infer<typeof BookingStatusSchema>;
export type PriceBreakdown = z.infer<typeof PriceBreakdownSchema>;
export type BookingRequest = z.infer<typeof BookingRequestSchema>;
export type BookingConfirmation = z.infer<typeof BookingConfirmationSchema>;
export type BookingListItem = z.infer<typeof BookingListItemSchema>;
export type BookingSearchFilters = z.infer<typeof BookingSearchFiltersSchema>;
export type BookingModification = z.infer<typeof BookingModificationSchema>;
export type BookingCancellation = z.infer<typeof BookingCancellationSchema>;

// Validation helpers
export const validateBookingRequest = (data: unknown): BookingRequest => {
  return BookingRequestSchema.parse(data);
};

export const validateBookingSearchFilters = (data: unknown): BookingSearchFilters => {
  return BookingSearchFiltersSchema.parse(data);
};

export const validateBookingModification = (data: unknown): BookingModification => {
  return BookingModificationSchema.parse(data);
};

export const validateBookingCancellation = (data: unknown): BookingCancellation => {
  return BookingCancellationSchema.parse(data);
};