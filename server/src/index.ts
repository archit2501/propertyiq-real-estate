import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import propertiesRouter from './routes/properties';
import marketRouter from './routes/market';
import analysisRouter from './routes/analysis';
import portfolioRouter from './routes/portfolio';
import authRouter from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.io setup for real-time updates
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/properties', propertiesRouter);
app.use('/api/market', marketRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/portfolio', portfolioRouter);

// Error handler
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('subscribe:property', (propertyId: string) => {
    socket.join(`property:${propertyId}`);
    logger.info(`Client ${socket.id} subscribed to property ${propertyId}`);
  });

  socket.on('subscribe:market', (zipCode: string) => {
    socket.join(`market:${zipCode}`);
    logger.info(`Client ${socket.id} subscribed to market ${zipCode}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Export io for use in other modules
export { io };

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  logger.info(`PropertyIQ server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
