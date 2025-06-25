import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { getCostSummary } from '@/middleware/costControl';
import { sanitizeInputs } from '@/middleware/inputSanitization';
import { z } from 'zod';

const router = Router();

// Query schema for cost summary
const CostSummaryQuerySchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

/**
 * @route   GET /api/v1/billing/usage
 * @desc    Get user's cost and usage summary
 * @access  Private
 */
router.get(
  '/usage',
  requireAuth(),
  sanitizeInputs({ querySchema: CostSummaryQuerySchema }),
  getCostSummary()
);

/**
 * @route   GET /api/v1/billing/plans
 * @desc    Get available subscription plans
 * @access  Public
 */
router.get('/plans', (_req, res) => {
  res.json({
    success: true,
    data: {
      plans: [
        {
          id: 'free',
          name: 'Free',
          price: 0,
          limits: {
            dailyTokens: 10000,
            monthlyTokens: 100000,
            dailyCost: 0.5,
            monthlyCost: 5.0,
            requestsPerMinute: 5,
          },
          features: [
            '10 AI conversations per day',
            '100 flight searches per month',
            'Email notifications',
            'Basic support',
          ],
        },
        {
          id: 'basic',
          name: 'Basic',
          price: 9.99,
          limits: {
            dailyTokens: 50000,
            monthlyTokens: 1000000,
            dailyCost: 5.0,
            monthlyCost: 50.0,
            requestsPerMinute: 20,
          },
          features: [
            '50 AI conversations per day',
            '1000 flight searches per month',
            'Priority email notifications',
            'Email support',
            'Advanced search filters',
          ],
        },
        {
          id: 'premium',
          name: 'Premium',
          price: 49.99,
          limits: {
            dailyTokens: 200000,
            monthlyTokens: 5000000,
            dailyCost: 20.0,
            monthlyCost: 200.0,
            requestsPerMinute: 50,
          },
          features: [
            '200 AI conversations per day',
            'Unlimited flight searches',
            'Real-time notifications',
            'Priority support',
            'API access',
            'Custom alerts',
          ],
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          price: null, // Custom pricing
          limits: {
            dailyTokens: 1000000,
            monthlyTokens: 30000000,
            dailyCost: 100.0,
            monthlyCost: 1000.0,
            requestsPerMinute: 200,
          },
          features: [
            'Unlimited AI conversations',
            'Unlimited flight searches',
            'Dedicated support',
            'Custom integrations',
            'SLA guarantee',
            'Advanced analytics',
          ],
        },
      ],
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * @route   POST /api/v1/billing/upgrade
 * @desc    Upgrade subscription plan
 * @access  Private
 */
router.post(
  '/upgrade',
  requireAuth(),
  sanitizeInputs({
    bodySchema: z.object({
      planId: z.enum(['free', 'basic', 'premium', 'enterprise']),
      paymentMethodId: z.string().optional(), // For Stripe integration
    }),
  }),
  async (_req, res) => {
    // TODO: Implement Stripe payment processing
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Payment processing not yet implemented in MVP',
      },
    });
  }
);

export default router;
