/**
 * Booking Cancellation Email Template
 * Professional HTML email template for flight booking cancellations
 */

import { BookingConfirmation } from '@/schemas/booking';
import { format } from 'date-fns';

interface CancellationEmailData {
  booking: BookingConfirmation;
  reason: string;
  refundAmount?: number;
  refundStatus?: 'PENDING' | 'PROCESSED' | 'NOT_APPLICABLE';
  logoUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  websiteUrl?: string;
}

export const generateBookingCancellationEmail = (data: CancellationEmailData): { html: string; text: string } => {
  const { booking, reason, refundAmount, refundStatus } = data;
  const departure = booking.flightOffer.itineraries[0].segments[0];
  const arrival = booking.flightOffer.itineraries[0].segments[
    booking.flightOffer.itineraries[0].segments.length - 1
  ];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Cancellation - ${booking.pnr}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f7f7f7;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background-color: #dc2626;
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    .booking-ref {
      background-color: rgba(255, 255, 255, 0.2);
      display: inline-block;
      padding: 10px 20px;
      border-radius: 5px;
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 2px;
    }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 20px;
      color: #dc2626;
      margin-bottom: 15px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 5px;
    }
    .cancellation-details {
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .label {
      font-weight: 600;
      color: #4b5563;
    }
    .value {
      color: #333;
    }
    .flight-summary {
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .refund-info {
      background-color: #f0fdf4;
      border: 1px solid #86efac;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .refund-info.pending {
      background-color: #fef3c7;
      border-color: #fbbf24;
    }
    .refund-info.not-applicable {
      background-color: #f3f4f6;
      border-color: #d1d5db;
    }
    .important-info {
      background-color: #fef3c7;
      border: 1px solid #fbbf24;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .important-info h3 {
      color: #92400e;
      margin-bottom: 10px;
    }
    .footer {
      background-color: #f3f4f6;
      padding: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      background-color: #dc2626;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 10px 5px;
    }
    .button:hover {
      background-color: #b91c1c;
    }
    .button.secondary {
      background-color: #6b7280;
    }
    .button.secondary:hover {
      background-color: #4b5563;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Booking Cancelled</h1>
      <div class="booking-ref">PNR: ${booking.pnr}</div>
    </div>
    
    <div class="content">
      <div class="section">
        <h2 class="section-title">Cancellation Details</h2>
        <div class="cancellation-details">
          <div class="detail-row">
            <span class="label">Cancellation Date:</span>
            <span class="value">${format(new Date(), 'MMMM d, yyyy h:mm a')}</span>
          </div>
          <div class="detail-row">
            <span class="label">Status:</span>
            <span class="value">CANCELLED</span>
          </div>
          <div class="detail-row">
            <span class="label">Reason:</span>
            <span class="value">${reason}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">Cancelled Flight Details</h2>
        <div class="flight-summary">
          <div class="detail-row">
            <span class="label">Route:</span>
            <span class="value">${departure.departure.iataCode} → ${arrival.arrival.iataCode}</span>
          </div>
          <div class="detail-row">
            <span class="label">Departure Date:</span>
            <span class="value">${format(new Date(departure.departure.at), 'EEEE, MMMM d, yyyy')}</span>
          </div>
          <div class="detail-row">
            <span class="label">Flight Number:</span>
            <span class="value">${departure.carrierCode}${departure.number}</span>
          </div>
          <div class="detail-row">
            <span class="label">Passengers:</span>
            <span class="value">${booking.passengers.length} passenger${booking.passengers.length > 1 ? 's' : ''}</span>
          </div>
          <div class="detail-row">
            <span class="label">Original Booking Amount:</span>
            <span class="value">${booking.priceBreakdown.currency} ${booking.priceBreakdown.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      ${refundStatus && refundStatus !== 'NOT_APPLICABLE' ? `
      <div class="section">
        <h2 class="section-title">Refund Information</h2>
        <div class="refund-info ${refundStatus === 'PENDING' ? 'pending' : ''}">
          <div class="detail-row">
            <span class="label">Refund Status:</span>
            <span class="value">${refundStatus === 'PENDING' ? 'Processing' : 'Completed'}</span>
          </div>
          <div class="detail-row">
            <span class="label">Refund Amount:</span>
            <span class="value">${booking.priceBreakdown.currency} ${(refundAmount || booking.priceBreakdown.grandTotal).toFixed(2)}</span>
          </div>
          <div class="detail-row">
            <span class="label">Processing Time:</span>
            <span class="value">5-10 business days</span>
          </div>
          <p style="margin-top: 15px; font-size: 14px; color: #6b7280;">
            ${refundStatus === 'PENDING' 
              ? 'Your refund is being processed and will be credited to your original payment method.'
              : 'Your refund has been processed and should appear in your account soon.'
            }
          </p>
        </div>
      </div>
      ` : ''}

      <div class="important-info">
        <h3>What Happens Next?</h3>
        <ul style="margin-left: 20px;">
          <li>You will receive a final cancellation confirmation within 24 hours.</li>
          ${refundStatus && refundStatus !== 'NOT_APPLICABLE' 
            ? '<li>Refunds typically appear in your account within 5-10 business days.</li>'
            : ''
          }
          <li>If you need to book a new flight, you can do so through our website.</li>
          <li>Save this email for your records.</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${data.websiteUrl || '#'}/bookings/new" class="button">Book New Flight</a>
        <a href="${data.websiteUrl || '#'}/support" class="button secondary">Contact Support</a>
      </div>
    </div>

    <div class="footer">
      <p>We're sorry to see your plans have changed.</p>
      <p>
        Need assistance? We're here to help:<br>
        ${data.supportEmail || 'support@example.com'} | ${data.supportPhone || '+1-800-FLIGHTS'}
      </p>
      <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
        This email confirms the cancellation of your booking. Please keep it for your records.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
BOOKING CANCELLATION CONFIRMATION
=================================

Your booking has been cancelled.
Booking Reference (PNR): ${booking.pnr}

CANCELLATION DETAILS
-------------------
Cancellation Date: ${format(new Date(), 'MMMM d, yyyy h:mm a')}
Status: CANCELLED
Reason: ${reason}

CANCELLED FLIGHT DETAILS
-----------------------
Route: ${departure.departure.iataCode} → ${arrival.arrival.iataCode}
Departure Date: ${format(new Date(departure.departure.at), 'EEEE, MMMM d, yyyy')}
Flight Number: ${departure.carrierCode}${departure.number}
Passengers: ${booking.passengers.length} passenger${booking.passengers.length > 1 ? 's' : ''}
Original Booking Amount: ${booking.priceBreakdown.currency} ${booking.priceBreakdown.grandTotal.toFixed(2)}

${refundStatus && refundStatus !== 'NOT_APPLICABLE' ? `
REFUND INFORMATION
------------------
Refund Status: ${refundStatus === 'PENDING' ? 'Processing' : 'Completed'}
Refund Amount: ${booking.priceBreakdown.currency} ${(refundAmount || booking.priceBreakdown.grandTotal).toFixed(2)}
Processing Time: 5-10 business days
${refundStatus === 'PENDING' 
  ? 'Your refund is being processed and will be credited to your original payment method.'
  : 'Your refund has been processed and should appear in your account soon.'
}
` : ''}

WHAT HAPPENS NEXT?
-----------------
- You will receive a final cancellation confirmation within 24 hours
${refundStatus && refundStatus !== 'NOT_APPLICABLE' 
  ? '- Refunds typically appear in your account within 5-10 business days'
  : ''
}
- If you need to book a new flight, you can do so through our website
- Save this email for your records

We're sorry to see your plans have changed.

Need assistance? We're here to help:
${data.supportEmail || 'support@example.com'} | ${data.supportPhone || '+1-800-FLIGHTS'}
  `;

  return { html, text };
};