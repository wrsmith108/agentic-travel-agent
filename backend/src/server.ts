import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import session from 'express-session';
import { env } from './config/env';
import createLogger, { logger } from './utils/logger';
import { requestLoggingMiddleware, getHealthStatus, getSimpleMetrics } from './utils/monitoring';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { globalRateLimiter } from './middleware/rateLimiting';
import { sanitizeInputs } from './middleware/inputSanitization';
import { auditLog } from './middleware/costControl';
import { initializeStorage, logStorageCapabilities } from './services/storage/storageAdapter';
import { initializeSessionStore, logSessionStoreCapabilities, getSessionStoreConfig } from './config/sessionStore';
import { priceMonitoringProcessor } from './services/batch/priceMonitoringProcessor';
import type { Request, Response } from 'express';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

// Create Express app
const app = express();

// Request ID middleware
app.use((req: Request, _res: Response, next) => {
  req.id = Math.random().toString(36).substring(2, 15);
  next();
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'development' ? false : {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin:
      env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Serve static files from public directory
app.use(express.static('public'));

// Logging middleware
app.use(
  morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  })
);

// Session middleware (store will be set during startup)
let sessionMiddleware: any;

// Request logging middleware
app.use(requestLoggingMiddleware);

// Global rate limiting (first line of defense)
app.use(globalRateLimiter);

// Global input sanitization
app.use(sanitizeInputs());

// Audit logging for security-sensitive endpoints
app.use('/api/v1/auth', auditLog('auth'));
app.use('/api/v1/users', auditLog('user-management'));

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to check health status',
    });
  }
});

// Simple metrics endpoint (for debugging)
app.get('/metrics', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: getSimpleMetrics(),
  });
});

// API info endpoint
app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: 'Agentic Travel Agent API',
      version: '1.0.0',
      environment: env.NODE_ENV,
      features: {
        demoMode: env.FEATURE_DEMO_MODE,
        emailNotifications: env.FEATURE_EMAIL_NOTIFICATIONS,
      },
    },
  });
});

// API Routes
// Switch between old and new auth implementation
const USE_NEW_AUTH = process.env.USE_NEW_AUTH === 'true' || false;
import authRoutesOld from './routes/auth';
import authRoutesNew from './routes/authNew';
import billingRoutes from './routes/billing';
import demoRoutes from './routes/demo';
import devAuthRoutes from './routes/devAuth';

const authRoutes = USE_NEW_AUTH ? authRoutesNew : authRoutesOld;
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/demo', demoRoutes);

// Additional routes
import conversationRoutes from './routes/conversation';
import flightRoutes from './routes/flights';
import monitoringRoutes from './routes/monitoring';
import travelAgentRoutes from './routes/travelAgent';
import preferencesRoutes from './routes/preferences';
import searchesRoutes from './routes/searches';
import priceAlertsRoutes from './routes/priceAlerts';

app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/flights', flightRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/travel-agent', travelAgentRoutes);
app.use('/api/v1/preferences', preferencesRoutes);
app.use('/api/v1/searches', searchesRoutes);
app.use('/api/v1/price-alerts', priceAlertsRoutes);

// Development-only authentication route
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/v1/dev', devAuthRoutes);
}

// Additional routes will be added here
// app.use('/api/v1/users', userRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Initialize storage before starting server
async function startServer() {
  try {
    // Initialize storage adapter (database or file mode)
    await initializeStorage();
    logStorageCapabilities();
    
    // Initialize session store (Redis or memory mode)
    await initializeSessionStore();
    logSessionStoreCapabilities();
    
    // Configure session middleware with the initialized store
    sessionMiddleware = session({
      store: getSessionStoreConfig(),
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      },
    });
    
    // Add session middleware to app
    app.use(sessionMiddleware);
    
    // Start price monitoring processor if not in test environment
    if (env.NODE_ENV !== 'test' && env.FEATURE_EMAIL_NOTIFICATIONS) {
      logger.info('🔍 Starting price monitoring processor');
      priceMonitoringProcessor.start(env.PRICE_MONITOR_CRON_PATTERN);
    }
    
    // Start server
    const PORT = env.PORT;
    const HOST = env.HOST;

    const server = app.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running at http://${HOST}:${PORT}`);
      logger.info(`📊 Environment: ${env.NODE_ENV}`);
      logger.info(`🔧 Demo mode: ${env.FEATURE_DEMO_MODE ? 'ON' : 'OFF'}`);
      logger.info(`📧 Email Notifications: ${env.FEATURE_EMAIL_NOTIFICATIONS ? 'ON' : 'OFF'}`);
      logger.info(`🔍 Price Monitoring: ${env.FEATURE_EMAIL_NOTIFICATIONS ? 'ON' : 'OFF'}`);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : 'Unknown error' });
    process.exit(1);
  }
}

// Start the server
let serverInstance: any = null;
const serverPromise = startServer().then(server => {
  serverInstance = server;
  return server;
});

// Graceful shutdown
const gracefulShutdown = (): void => {
  logger.info('🛑 Received shutdown signal, closing server gracefully...');

  // Stop price monitoring processor
  priceMonitoringProcessor.stop();
  logger.info('🔍 Price monitoring processor stopped');

  if (serverInstance) {
    serverInstance.close(() => {
      logger.info('✅ Server closed successfully');
      process.exit(0);
    });
  } else {
    logger.info('✅ Server not yet started, exiting gracefully');
    process.exit(0);
  }

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught errors (already logged by logger)
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection:', { reason, promise });
  gracefulShutdown();
});

export default app;
