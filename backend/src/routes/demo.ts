import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sanitizeInputs } from '@/middleware/inputSanitization';
import { 
  DEMO_CONVERSATIONS, 
  generatePriceInsight, 
  generateMockPriceHistory,
  MOCK_PRICE_PATTERNS 
} from '@/services/ai/travelPrompts';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Demo search schema
const DemoSearchSchema = z.object({
  message: z.string().min(1).max(500),
  sessionId: z.string().uuid().optional(),
});

// Demo flight search result schema
const FlightResultSchema = z.object({
  origin: z.string().regex(/^[A-Z]{3}$/),
  destination: z.string().regex(/^[A-Z]{3}$/),
  departureDate: z.string().date(),
  returnDate: z.string().date().optional(),
  currentPrice: z.number().positive(),
  currency: z.enum(['CAD', 'USD']).default('CAD'),
});

/**
 * @route   POST /api/v1/demo/chat
 * @desc    Demo conversational interface with mock travel insights
 * @access  Public (no auth for demo)
 */
router.post(
  '/chat',
  sanitizeInputs({ bodySchema: DemoSearchSchema }),
  async (req: Request, res: Response) => {
    const { message, sessionId = uuidv4() } = req.body;

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 800));

    // Check if this matches a demo conversation
    const demoMatch = DEMO_CONVERSATIONS.find(
      conv => conv.user.toLowerCase().includes(message.toLowerCase().slice(0, 20))
    );

    if (demoMatch) {
      res.json({
        success: true,
        data: {
          sessionId,
          message: demoMatch.assistant,
          context: {
            type: 'flight_search',
            extracted: {
              destination: 'Tokyo',
              timeframe: 'April',
              flexibility: 'week',
            },
          },
          suggestions: [
            "Show me specific dates",
            "What about business class?",
            "Find cheaper alternatives",
            "Alert me when prices drop",
          ],
        },
      });
      return;
    }

    // Generate a generic helpful response
    const response = `I understand you're interested in: "${message}". 

I'm an AI travel agent that specializes in finding the best flight deals by analyzing historical prices and trends. 

Try asking me something like:
• "I want to visit Tokyo in April"
• "Find cheap flights to London next month"
• "When's the best time to book flights to Paris?"

I can help you understand pricing patterns and find the perfect time to book!`;

    res.json({
      success: true,
      data: {
        sessionId,
        message: response,
        context: {
          type: 'general',
        },
        suggestions: [
          "I want to visit Tokyo in April",
          "Find cheap flights to London",
          "Best time to visit Paris?",
          "Track prices to Rome",
        ],
      },
    });
  }
);

/**
 * @route   POST /api/v1/demo/analyze-price
 * @desc    Analyze flight prices with historical context
 * @access  Public (no auth for demo)
 */
router.post(
  '/analyze-price',
  sanitizeInputs({ bodySchema: FlightResultSchema }),
  async (req: Request, res: Response) => {
    const { origin, destination, departureDate, currentPrice } = req.body;

    const date = new Date(departureDate);
    const insight = generatePriceInsight(currentPrice, { origin, destination }, date);
    const priceHistory = generateMockPriceHistory({ origin, destination }, date);

    // Calculate statistics
    const prices = priceHistory.map(p => p.price);
    const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const currentPercentile = Math.round(
      (prices.filter(p => p <= currentPrice).length / prices.length) * 100
    );

    res.json({
      success: true,
      data: {
        analysis: {
          currentPrice,
          insight,
          recommendation: currentPercentile < 30 ? 'BUY' : currentPercentile < 60 ? 'WAIT' : 'AVOID',
          confidenceScore: 0.85,
        },
        statistics: {
          average: avgPrice,
          minimum: minPrice,
          maximum: maxPrice,
          currentPercentile,
          priceTrend: (() => {
            if (prices.length > 8) {
              const lastPrice = prices[prices.length - 1];
              const oldPrice = prices[prices.length - 8];
              return lastPrice !== undefined && oldPrice !== undefined && lastPrice > oldPrice ? 'rising' : 'falling';
            }
            return 'stable';
          })(),
        },
        priceHistory,
        alternatives: [
          {
            description: "Fly Tuesday/Wednesday",
            savings: "$50-100",
            effort: "low",
          },
          {
            description: `Consider nearby airports`,
            savings: "$100-200",
            effort: "medium",
          },
          {
            description: "Book connecting flight",
            savings: "$200-400",
            effort: "high",
          },
        ],
      },
    });
  }
);

/**
 * @route   GET /api/v1/demo/routes
 * @desc    Get available demo routes with insights
 * @access  Public
 */
router.get('/routes', (_req: Request, res: Response) => {
  const routes = Object.keys(MOCK_PRICE_PATTERNS).map(route => {
    const [origin, destination] = route.split('-');
    const pattern = MOCK_PRICE_PATTERNS[route as keyof typeof MOCK_PRICE_PATTERNS];
    
    // Calculate current month data
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
    const monthData = pattern.seasonal[currentMonth as keyof typeof pattern.seasonal];
    
    return {
      origin,
      destination,
      currentMonth: {
        average: monthData.avg,
        range: { low: monthData.low, high: monthData.high },
      },
      insights: pattern.insights,
      popularityScore: Math.round(Math.random() * 30 + 70), // 70-100
    };
  });

  res.json({
    success: true,
    data: {
      routes,
      trending: [
        { destination: "Tokyo", reason: "Cherry blossom season", discount: "15%" },
        { destination: "London", reason: "Off-peak season", discount: "25%" },
        { destination: "Paris", reason: "Winter sales", discount: "20%" },
      ],
    },
  });
});

/**
 * @route   POST /api/v1/demo/quick-search
 * @desc    Quick flight search with instant insights
 * @access  Public
 */
router.post(
  '/quick-search',
  sanitizeInputs({
    bodySchema: z.object({
      origin: z.string(),
      destination: z.string(),
      departureDate: z.string(),
      returnDate: z.string().optional(),
    }),
  }),
  async (req: Request, res: Response) => {
    const { origin, destination, departureDate } = req.body;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Generate mock flights with realistic pricing
    const baseDate = new Date(departureDate);
    const daysUntil = Math.floor((baseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    // Price varies by time until departure
    let priceMultiplier = 1;
    if (daysUntil < 7) priceMultiplier = 1.5;
    else if (daysUntil < 14) priceMultiplier = 1.3;
    else if (daysUntil < 30) priceMultiplier = 1.1;
    else if (daysUntil > 60) priceMultiplier = 0.9;

    const basePrice = 800;
    const flights = [
      {
        id: uuidv4(),
        airline: "Air Canada",
        departure: `${departureDate}T08:00:00`,
        arrival: `${departureDate}T14:30:00`,
        duration: "6h 30m",
        stops: 0,
        price: Math.round(basePrice * priceMultiplier * 1.2),
        cabin: "economy",
        insight: "Direct flight - worth the premium for convenience",
      },
      {
        id: uuidv4(),
        airline: "United Airlines",
        departure: `${departureDate}T10:30:00`,
        arrival: `${departureDate}T19:45:00`,
        duration: "9h 15m",
        stops: 1,
        price: Math.round(basePrice * priceMultiplier),
        cabin: "economy",
        insight: "Best value - good timing with short layover",
        recommended: true,
      },
      {
        id: uuidv4(),
        airline: "Multiple Airlines",
        departure: `${departureDate}T06:00:00`,
        arrival: `${departureDate}T22:30:00`,
        duration: "16h 30m",
        stops: 2,
        price: Math.round(basePrice * priceMultiplier * 0.75),
        cabin: "economy",
        insight: "Cheapest option - but long travel time",
      },
    ];

    // Get price analysis
    const recommendedFlight = flights.find(f => f.recommended) || flights[0];
    const priceInsight = generatePriceInsight(
      recommendedFlight?.price || 0,
      { origin: origin.toUpperCase(), destination: destination.toUpperCase() },
      baseDate
    );

    res.json({
      success: true,
      data: {
        searchId: uuidv4(),
        summary: {
          route: `${origin} → ${destination}`,
          date: departureDate,
          lowestPrice: Math.min(...flights.map(f => f.price)),
          priceInsight,
          bookingRecommendation: daysUntil < 21 ? "Book now - prices rising" : "Good time to book",
        },
        flights,
        monitoringOffer: {
          message: "I'll track these prices and alert you when they drop by $50 or more",
          targetPrice: Math.round(Math.min(...flights.map(f => f.price)) * 0.9),
          confidence: "Based on historical data, there's a 65% chance of finding a better price in the next 2 weeks",
        },
      },
    });
  }
);

export default router;