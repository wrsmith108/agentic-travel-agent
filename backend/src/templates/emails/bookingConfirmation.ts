/**
 * Booking Confirmation Email Template
 * Professional HTML email template for flight booking confirmations
 */

import { BookingConfirmation } from '@/schemas/booking';
import { format } from 'date-fns';

interface EmailData {
  booking: BookingConfirmation;
  logoUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  websiteUrl?: string;
}

export const generateBookingConfirmationEmail = (data: EmailData): { html: string; text: string } => {
  const { booking } = data;
  const departure = booking.flightOffer.itineraries[0].segments[0];
  const arrival = booking.flightOffer.itineraries[0].segments[
    booking.flightOffer.itineraries[0].segments.length - 1
  ];
  const returnDeparture = booking.flightOffer.itineraries[1]?.segments[0];
  const returnArrival = booking.flightOffer.itineraries[1]?.segments[
    booking.flightOffer.itineraries[1].segments.length - 1
  ];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation - ${booking.pnr}</title>
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
      background-color: #1e40af;
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
      color: #1e40af;
      margin-bottom: 15px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 5px;
    }
    .flight-details {
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .route {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
    }
    .airport {
      font-size: 24px;
      font-weight: bold;
      color: #1e40af;
    }
    .arrow {
      margin: 0 15px;
      color: #6b7280;
    }
    .datetime {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 5px;
    }
    .flight-info {
      display: flex;
      justify-content: space-between;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
    }
    .flight-info-item {
      text-align: center;
    }
    .label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
    }
    .value {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    .passenger-list {
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 8px;
    }
    .passenger {
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .passenger:last-child {
      border-bottom: none;
    }
    .price-summary {
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 8px;
    }
    .price-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .price-total {
      font-size: 20px;
      font-weight: bold;
      color: #1e40af;
      border-top: 2px solid #e5e7eb;
      padding-top: 10px;
      margin-top: 10px;
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
      background-color: #1e40af;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 10px 5px;
    }
    .button:hover {
      background-color: #1e3a8a;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✈️ Your Flight is Confirmed!</h1>
      <div class="booking-ref">PNR: ${booking.pnr}</div>
    </div>
    
    <div class="content">
      <div class="section">
        <h2 class="section-title">Outbound Flight</h2>
        <div class="flight-details">
          <div class="route">
            <span class="airport">${departure.departure.iataCode}</span>
            <span class="arrow">→</span>
            <span class="airport">${arrival.arrival.iataCode}</span>
          </div>
          <div class="datetime">
            ${format(new Date(departure.departure.at), 'EEEE, MMMM d, yyyy')}
          </div>
          <div class="flight-info">
            <div class="flight-info-item">
              <div class="label">Departure</div>
              <div class="value">${format(new Date(departure.departure.at), 'h:mm a')}</div>
            </div>
            <div class="flight-info-item">
              <div class="label">Arrival</div>
              <div class="value">${format(new Date(arrival.arrival.at), 'h:mm a')}</div>
            </div>
            <div class="flight-info-item">
              <div class="label">Flight</div>
              <div class="value">${departure.carrierCode}${departure.number}</div>
            </div>
            <div class="flight-info-item">
              <div class="label">Duration</div>
              <div class="value">${booking.flightOffer.itineraries[0].duration.replace('PT', '').toLowerCase()}</div>
            </div>
          </div>
        </div>
      </div>

      ${returnDeparture ? `
      <div class="section">
        <h2 class="section-title">Return Flight</h2>
        <div class="flight-details">
          <div class="route">
            <span class="airport">${returnDeparture.departure.iataCode}</span>
            <span class="arrow">→</span>
            <span class="airport">${returnArrival.arrival.iataCode}</span>
          </div>
          <div class="datetime">
            ${format(new Date(returnDeparture.departure.at), 'EEEE, MMMM d, yyyy')}
          </div>
          <div class="flight-info">
            <div class="flight-info-item">
              <div class="label">Departure</div>
              <div class="value">${format(new Date(returnDeparture.departure.at), 'h:mm a')}</div>
            </div>
            <div class="flight-info-item">
              <div class="label">Arrival</div>
              <div class="value">${format(new Date(returnArrival.arrival.at), 'h:mm a')}</div>
            </div>
            <div class="flight-info-item">
              <div class="label">Flight</div>
              <div class="value">${returnDeparture.carrierCode}${returnDeparture.number}</div>
            </div>
            <div class="flight-info-item">
              <div class="label">Duration</div>
              <div class="value">${booking.flightOffer.itineraries[1].duration.replace('PT', '').toLowerCase()}</div>
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      <div class="section">
        <h2 class="section-title">Passengers</h2>
        <div class="passenger-list">
          ${booking.passengers.map((p, index) => `
            <div class="passenger">
              <strong>${index + 1}. ${p.title} ${p.firstName} ${p.lastName}</strong>
              <div style="color: #6b7280; font-size: 14px;">
                ${p.type} • ${p.document.documentType}: ${p.document.documentNumber}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">Price Summary</h2>
        <div class="price-summary">
          <div class="price-row">
            <span>Base Fare (${booking.passengers.length} passenger${booking.passengers.length > 1 ? 's' : ''})</span>
            <span>${booking.priceBreakdown.currency} ${booking.priceBreakdown.baseFare.toFixed(2)}</span>
          </div>
          ${booking.priceBreakdown.taxes.map(tax => `
            <div class="price-row">
              <span>${tax.description}</span>
              <span>${booking.priceBreakdown.currency} ${tax.amount.toFixed(2)}</span>
            </div>
          `).join('')}
          ${booking.priceBreakdown.fees.map(fee => `
            <div class="price-row">
              <span>${fee.description}</span>
              <span>${booking.priceBreakdown.currency} ${fee.amount.toFixed(2)}</span>
            </div>
          `).join('')}
          ${booking.priceBreakdown.discount > 0 ? `
            <div class="price-row">
              <span>Discount</span>
              <span>-${booking.priceBreakdown.currency} ${booking.priceBreakdown.discount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="price-row price-total">
            <span>Total Amount</span>
            <span>${booking.priceBreakdown.currency} ${booking.priceBreakdown.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div class="important-info">
        <h3>Important Information</h3>
        <ul style="margin-left: 20px;">
          <li>Please arrive at the airport at least 2 hours before departure for domestic flights and 3 hours for international flights.</li>
          <li>Ensure all travel documents (passport, visa, etc.) are valid and up to date.</li>
          <li>Check-in online 24 hours before departure to secure your preferred seat.</li>
          ${booking.ticketingDeadline ? `<li><strong>Ticketing Deadline:</strong> ${format(new Date(booking.ticketingDeadline), 'MMMM d, yyyy h:mm a')}</li>` : ''}
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${data.websiteUrl || '#'}/bookings/${booking.bookingId}" class="button">View Booking</a>
        <a href="${data.websiteUrl || '#'}/check-in/${booking.pnr}" class="button">Check-In Online</a>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for choosing our service!</p>
      <p>
        Need help? Contact us at<br>
        ${data.supportEmail || 'support@example.com'} | ${data.supportPhone || '+1-800-FLIGHTS'}
      </p>
      <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
        This is a confirmation of your booking. Please keep this email for your records.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
BOOKING CONFIRMATION
===================

Your flight has been confirmed!
Booking Reference (PNR): ${booking.pnr}

OUTBOUND FLIGHT
---------------
${departure.departure.iataCode} → ${arrival.arrival.iataCode}
${format(new Date(departure.departure.at), 'EEEE, MMMM d, yyyy')}
Departure: ${format(new Date(departure.departure.at), 'h:mm a')}
Arrival: ${format(new Date(arrival.arrival.at), 'h:mm a')}
Flight: ${departure.carrierCode}${departure.number}
Duration: ${booking.flightOffer.itineraries[0].duration.replace('PT', '').toLowerCase()}

${returnDeparture ? `
RETURN FLIGHT
-------------
${returnDeparture.departure.iataCode} → ${returnArrival.arrival.iataCode}
${format(new Date(returnDeparture.departure.at), 'EEEE, MMMM d, yyyy')}
Departure: ${format(new Date(returnDeparture.departure.at), 'h:mm a')}
Arrival: ${format(new Date(returnArrival.arrival.at), 'h:mm a')}
Flight: ${returnDeparture.carrierCode}${returnDeparture.number}
Duration: ${booking.flightOffer.itineraries[1].duration.replace('PT', '').toLowerCase()}
` : ''}

PASSENGERS
----------
${booking.passengers.map((p, index) => 
  `${index + 1}. ${p.title} ${p.firstName} ${p.lastName} (${p.type})`
).join('\n')}

PRICE SUMMARY
-------------
Base Fare: ${booking.priceBreakdown.currency} ${booking.priceBreakdown.baseFare.toFixed(2)}
Taxes & Fees: ${booking.priceBreakdown.currency} ${(
  booking.priceBreakdown.taxes.reduce((sum, tax) => sum + tax.amount, 0) +
  booking.priceBreakdown.fees.reduce((sum, fee) => sum + fee.amount, 0)
).toFixed(2)}
${booking.priceBreakdown.discount > 0 ? `Discount: -${booking.priceBreakdown.currency} ${booking.priceBreakdown.discount.toFixed(2)}` : ''}
Total: ${booking.priceBreakdown.currency} ${booking.priceBreakdown.grandTotal.toFixed(2)}

IMPORTANT INFORMATION
--------------------
- Arrive at the airport at least 2 hours before departure (3 hours for international)
- Ensure all travel documents are valid
- Check-in online 24 hours before departure
${booking.ticketingDeadline ? `- Ticketing Deadline: ${format(new Date(booking.ticketingDeadline), 'MMMM d, yyyy h:mm a')}` : ''}

Thank you for choosing our service!

Need help? Contact us at:
${data.supportEmail || 'support@example.com'} | ${data.supportPhone || '+1-800-FLIGHTS'}
  `;

  return { html, text };
};