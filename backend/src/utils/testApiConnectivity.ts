import { env } from '../config/env';
import Anthropic from '@anthropic-ai/sdk';
import Amadeus from 'amadeus';
import sgMail from '@sendgrid/mail';

interface ApiTestResult {
  service: string;
  status: 'success' | 'error';
  message: string;
  details?: unknown;
}

export async function testApiConnectivity(): Promise<ApiTestResult[]> {
  const results: ApiTestResult[] = [];

  // Test Anthropic API
  try {
    const anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });

    if (env.FEATURE_DEMO_MODE) {
      results.push({
        service: 'Anthropic (Claude)',
        status: 'success',
        message: 'Demo mode - skipping actual API call',
      });
    } else {
      const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Test' }],
      });
      results.push({
        service: 'Anthropic (Claude)',
        status: 'success',
        message: 'Connected successfully',
        details: { model: response.model },
      });
    }
  } catch (error) {
    results.push({
      service: 'Anthropic (Claude)',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test Amadeus API
  try {
    const amadeus = new Amadeus({
      clientId: env.AMADEUS_CLIENT_ID,
      clientSecret: env.AMADEUS_CLIENT_SECRET,
      hostname: env.AMADEUS_ENVIRONMENT === 'production' ? 'production' : 'test',
    });

    if (env.FEATURE_DEMO_MODE) {
      results.push({
        service: 'Amadeus',
        status: 'success',
        message: 'Demo mode - skipping actual API call',
      });
    } else {
      // Test with a simple location search
      const response = await amadeus.referenceData.locations.get({
        keyword: 'NYC',
        subType: Amadeus.location.city,
      });
      results.push({
        service: 'Amadeus',
        status: 'success',
        message: `Connected to ${env.AMADEUS_ENVIRONMENT} environment`,
        details: { resultCount: response.data.length },
      });
    }
  } catch (error) {
    results.push({
      service: 'Amadeus',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test SendGrid
  try {
    sgMail.setApiKey(env.SENDGRID_API_KEY);

    if (env.FEATURE_DEMO_MODE || env.SENDGRID_ENVIRONMENT === 'sandbox') {
      results.push({
        service: 'SendGrid',
        status: 'success',
        message: 'Demo/Sandbox mode - API key configured',
      });
    } else {
      // In production, we could verify with a different endpoint
      results.push({
        service: 'SendGrid',
        status: 'success',
        message: 'API key configured (production mode)',
      });
    }
  } catch (error) {
    results.push({
      service: 'SendGrid',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return results;
}

// Run if executed directly
if (require.main === module) {
  console.log('🔍 Testing API Connectivity...\n');
  testApiConnectivity()
    .then((results) => {
      results.forEach((result) => {
        const icon = result.status === 'success' ? '✅' : '❌';
        console.log(`${icon} ${result.service}: ${result.message}`);
        if (result.details) {
          console.log(`   Details:`, result.details);
        }
      });
      console.log('\n✨ API connectivity test complete!');
    })
    .catch((error) => {
      console.error('💥 Error running connectivity test:', error);
      process.exit(1);
    });
}
