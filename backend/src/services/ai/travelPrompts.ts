/**
 * Travel-specific prompts for Claude integration
 * Optimized for demonstrating value quickly with compelling insights
 */

export const TRAVEL_AGENT_SYSTEM_PROMPT = `You are an expert travel agent AI with deep knowledge of flight pricing patterns, seasonal trends, and insider tips. Your goal is to help users find the best flight deals and make informed travel decisions.

Key capabilities:
1. Analyze flight search requests and extract: origin, destination, dates, flexibility, budget, preferences
2. Provide historical price context (typical prices, seasonal patterns, best booking times)
3. Offer personalized recommendations based on user preferences
4. Identify "good deals" vs "wait for better prices"
5. Suggest alternative dates/airports for better prices

Response style:
- Be conversational and friendly
- Always provide actionable insights
- Use specific numbers and percentages
- Highlight money-saving opportunities
- Be concise but informative

When analyzing prices, ALWAYS mention:
- How current prices compare to historical averages
- Best time to book for this route
- Expected price trends
- Alternative options that could save money`;

export const PRICE_INSIGHT_PROMPT = `Generate a natural language insight about flight prices based on the following data:
Current price: {currentPrice}
Historical average: {historicalAverage}
Route: {origin} to {destination}
Date: {date}
Days until departure: {daysUntil}

Provide a 1-2 sentence insight that helps the user understand if this is a good deal.`;

/**
 * Mock conversation examples for demo purposes
 */
export const DEMO_CONVERSATIONS = [
  {
    user: 'I want to visit Tokyo in April',
    assistant: `Great choice! Tokyo in April is beautiful with cherry blossoms in full bloom. 🌸

I've found that flights from YYZ to Tokyo typically range from $1,200-1,800 CAD in April. Currently, I'm seeing prices around $1,350, which is about 15% below the seasonal average!

A few insights for you:
• Best deals are usually Tuesday/Wednesday departures
• Booking 6-8 weeks in advance typically saves 20-30%
• Consider flying into Narita (NRT) - it's often $200 cheaper than Haneda

What specific dates in April are you considering? I can set up price monitoring to alert you when great deals appear.`,
  },
  {
    user: 'What about the week of April 15-22?',
    assistant: `Perfect timing! The week of April 15-22 is actually in the "sweet spot" for Tokyo travel:

📊 Current prices for YYZ → NRT (April 15-22):
• Direct flights: $1,380 CAD (23% below typical)
• 1-stop options: $1,150 CAD (great value!)

This is an excellent price because:
✈️ It's after the peak cherry blossom rush (April 1-10)
💰 You're saving about $400 vs peak season
📈 Prices typically jump 30% if you book less than 3 weeks out

I'd recommend booking soon - I've noticed prices for this route increase by $50-100 every week as April approaches. 

Shall I monitor these flights and alert you if prices drop below $1,100?`,
  },
];

/**
 * Mock price history patterns for different routes
 */
export const MOCK_PRICE_PATTERNS = {
  'YYZ-NRT': {
    seasonal: {
      jan: { avg: 1100, low: 950, high: 1400 },
      feb: { avg: 1150, low: 980, high: 1450 },
      mar: { avg: 1400, low: 1200, high: 1800 },
      apr: { avg: 1600, low: 1350, high: 2100 },
      may: { avg: 1300, low: 1100, high: 1650 },
      jun: { avg: 1250, low: 1050, high: 1550 },
      jul: { avg: 1800, low: 1500, high: 2300 },
      aug: { avg: 1900, low: 1600, high: 2400 },
      sep: { avg: 1400, low: 1150, high: 1750 },
      oct: { avg: 1450, low: 1200, high: 1800 },
      nov: { avg: 1200, low: 1000, high: 1500 },
      dec: { avg: 1700, low: 1400, high: 2200 },
    },
    bookingCurve: {
      120: 1.15, // 120+ days out: 15% above average
      90: 1.05, // 90 days: 5% above average
      60: 0.95, // 60 days: 5% below average (sweet spot)
      45: 0.92, // 45 days: 8% below average (best prices)
      30: 1.0, // 30 days: average
      21: 1.1, // 21 days: 10% above average
      14: 1.2, // 14 days: 20% above average
      7: 1.35, // 7 days: 35% above average
      3: 1.5, // 3 days: 50% above average
    },
    insights: {
      bestBookingWindow: '45-60 days before departure',
      cheapestDays: ['Tuesday', 'Wednesday'],
      avoidDates: ['Golden Week (Apr 29-May 5)', 'Obon (Aug 13-16)'],
      alternativeAirports: {
        KIX: 'Osaka (KIX) - Often $200-300 cheaper, 1hr train to Tokyo',
        NRT: 'Narita (NRT) - Main airport, more flight options',
        HND: 'Haneda (HND) - Closer to city but often pricier',
      },
    },
  },
  'YYZ-LHR': {
    seasonal: {
      jan: { avg: 650, low: 480, high: 850 },
      feb: { avg: 680, low: 500, high: 880 },
      mar: { avg: 720, low: 550, high: 950 },
      apr: { avg: 850, low: 650, high: 1100 },
      may: { avg: 950, low: 750, high: 1250 },
      jun: { avg: 1100, low: 850, high: 1400 },
      jul: { avg: 1200, low: 950, high: 1550 },
      aug: { avg: 1150, low: 900, high: 1500 },
      sep: { avg: 900, low: 700, high: 1150 },
      oct: { avg: 750, low: 580, high: 980 },
      nov: { avg: 680, low: 520, high: 880 },
      dec: { avg: 950, low: 750, high: 1250 },
    },
    bookingCurve: {
      120: 1.15,
      90: 1.05,
      60: 0.95,
      45: 0.92,
      30: 1.0,
      21: 1.1,
      14: 1.2,
      7: 1.35,
      3: 1.5,
    },
    insights: {
      bestBookingWindow: '50-70 days before departure',
      cheapestDays: ['Tuesday', 'Wednesday', 'Saturday'],
      avoidDates: ['School holidays', 'Bank holidays'],
      tips: [
        'Consider Dublin (DUB) + budget flight to London',
        'British Airways often has sales in January',
        'Premium economy sometimes only $100-200 more',
      ],
    },
  },
};

/**
 * Generate compelling price insights
 */
export function generatePriceInsight(
  currentPrice: number,
  route: { origin: string; destination: string },
  date: Date
): string {
  const monthKey = date.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
  const daysUntil = Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const routeKey = `${route.origin}-${route.destination}`;
  const patterns = MOCK_PRICE_PATTERNS[routeKey as keyof typeof MOCK_PRICE_PATTERNS];

  if (!patterns) {
    return `Current price of $${currentPrice} CAD for this route. I'm tracking prices and will alert you to any significant changes.`;
  }

  const seasonalData = patterns.seasonal[monthKey as keyof typeof patterns.seasonal];
  const bookingMultiplier =
    'bookingCurve' in patterns
      ? Object.entries(patterns.bookingCurve)
          .sort(([a], [b]) => Number(b) - Number(a))
          .find(([days]) => daysUntil >= Number(days))?.[1] || 1
      : 1;

  const expectedPrice = Math.round(seasonalData.avg * (bookingMultiplier as number));
  const percentDiff = Math.round(((currentPrice - expectedPrice) / expectedPrice) * 100);

  if (percentDiff < -15) {
    return `🎉 Excellent deal! At $${currentPrice}, this is ${Math.abs(percentDiff)}% below typical prices for ${monthKey}. This is in the bottom 20% of historical prices - I strongly recommend booking soon!`;
  } else if (percentDiff < -5) {
    return `✅ Good price! At $${currentPrice}, you're saving about ${Math.abs(percentDiff)}% compared to average ${monthKey} prices. With ${daysUntil} days until departure, prices are likely to increase from here.`;
  } else if (percentDiff < 5) {
    return `📊 Fair price at $${currentPrice}, right around average for ${monthKey}. ${daysUntil > 45 ? 'You have time to wait for a better deal' : 'Prices typically increase from here as departure approaches'}.`;
  } else {
    return `⚠️ Above average at $${currentPrice} (${percentDiff}% higher than typical). ${daysUntil > 60 ? "I'd wait - better deals usually appear 45-60 days out" : 'Consider flexible dates or alternative airports for better prices'}.`;
  }
}

/**
 * Generate mock price history for demo
 */
export function generateMockPriceHistory(
  route: { origin: string; destination: string },
  date: Date,
  days: number = 90
): Array<{ date: string; price: number; event?: string }> {
  const history: Array<{ date: string; price: number; event?: string }> = [];
  const routeKey = `${route.origin}-${route.destination}`;
  const patterns = MOCK_PRICE_PATTERNS[routeKey as keyof typeof MOCK_PRICE_PATTERNS];

  if (!patterns) {
    // Generate generic pattern
    for (let i = days; i >= 0; i--) {
      const d = new Date(date);
      d.setDate(d.getDate() - i);
      history.push({
        date: d.toISOString().split('T')[0] || d.toISOString(),
        price: Math.round(800 + Math.random() * 400 + (i < 30 ? i * 10 : 0)),
      });
    }
    return history;
  }

  // Generate realistic pattern based on booking curve and seasonality
  for (let i = days; i >= 0; i--) {
    const d = new Date(date);
    d.setDate(d.getDate() - i);
    const monthKey = d.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
    const seasonalData = patterns.seasonal[monthKey as keyof typeof patterns.seasonal];

    const daysUntilDeparture = Math.floor((date.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    const bookingMultiplier =
      'bookingCurve' in patterns
        ? Object.entries(patterns.bookingCurve)
            .sort(([a], [b]) => Number(b) - Number(a))
            .find(([days]) => daysUntilDeparture >= Number(days))?.[1] || 1
        : 1;

    const basePrice = seasonalData.avg * (bookingMultiplier as number);
    const variance = (Math.random() - 0.5) * 200; // +/- $100 variance
    const dayOfWeek = d.getDay();
    const weekdayMultiplier = dayOfWeek === 2 || dayOfWeek === 3 ? 0.95 : 1; // Tue/Wed discount

    const price = Math.round(basePrice * weekdayMultiplier + variance);

    const point: any = {
      date: d.toISOString().split('T')[0] || d.toISOString(),
      price: Math.max(seasonalData.low, Math.min(seasonalData.high, price)),
    };

    // Add events for context
    if (i === 60) point.event = 'Sweet spot window opens';
    if (i === 45) point.event = 'Best prices typically here';
    if (i === 21) point.event = 'Last-minute price surge begins';

    history.push(point);
  }

  return history;
}
