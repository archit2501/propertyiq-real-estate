import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { io } from '../index';

const router = Router();
const prisma = new PrismaClient();

// All portfolio routes require authentication
router.use(authenticate);

// GET /api/portfolio - Get user's portfolios
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            property: {
              select: {
                id: true,
                address: true,
                city: true,
                state: true,
                listPrice: true,
                predictedPrice: true,
                investmentScore: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Calculate portfolio metrics
    const enrichedPortfolios = portfolios.map((portfolio) => {
      const totalValue = portfolio.items.reduce(
        (sum, item) => sum + item.property.listPrice, 0
      );
      const avgScore = portfolio.items.length > 0
        ? portfolio.items.reduce(
            (sum, item) => sum + (item.property.investmentScore || 0), 0
          ) / portfolio.items.length
        : 0;

      return {
        ...portfolio,
        metrics: {
          totalValue,
          propertyCount: portfolio.items.length,
          averageInvestmentScore: Math.round(avgScore),
        },
      };
    });

    res.json({
      success: true,
      data: enrichedPortfolios,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/portfolio - Create a new portfolio
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    });

    const input = schema.parse(req.body);

    const portfolio = await prisma.portfolio.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
      },
    });

    res.status(201).json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/portfolio/:id - Get portfolio details
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const portfolio = await prisma.portfolio.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: {
            property: true,
          },
        },
      },
    });

    if (!portfolio) {
      return res.status(404).json({ success: false, error: 'Portfolio not found' });
    }

    res.json({ success: true, data: portfolio });
  } catch (error) {
    next(error);
  }
});

// POST /api/portfolio/:id/items - Add property to portfolio
router.post('/:id/items', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id: portfolioId } = req.params;

    const schema = z.object({
      propertyId: z.string().uuid(),
      notes: z.string().max(500).optional(),
      targetPrice: z.number().positive().optional(),
      alertEnabled: z.boolean().default(false),
    });

    const input = schema.parse(req.body);

    // Verify portfolio ownership
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });

    if (!portfolio) {
      return res.status(404).json({ success: false, error: 'Portfolio not found' });
    }

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: input.propertyId },
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    // Add to portfolio
    const item = await prisma.portfolioItem.create({
      data: {
        portfolioId,
        propertyId: input.propertyId,
        notes: input.notes,
        targetPrice: input.targetPrice,
        alertEnabled: input.alertEnabled,
      },
      include: {
        property: true,
      },
    });

    res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/portfolio/:id/items/:itemId - Remove property from portfolio
router.delete('/:id/items/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id: portfolioId, itemId } = req.params;

    // Verify portfolio ownership
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });

    if (!portfolio) {
      return res.status(404).json({ success: false, error: 'Portfolio not found' });
    }

    await prisma.portfolioItem.delete({
      where: { id: itemId },
    });

    res.json({ success: true, message: 'Property removed from portfolio' });
  } catch (error) {
    next(error);
  }
});

// GET /api/portfolio/:id/performance - Get portfolio performance analytics
router.get('/:id/performance', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const portfolio = await prisma.portfolio.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: {
            property: true,
          },
        },
      },
    });

    if (!portfolio) {
      return res.status(404).json({ success: false, error: 'Portfolio not found' });
    }

    const items = portfolio.items;

    if (items.length === 0) {
      return res.json({
        success: true,
        data: {
          portfolioId: id,
          message: 'No properties in portfolio',
          metrics: null,
        },
      });
    }

    // Calculate portfolio metrics
    const totalListValue = items.reduce((sum, i) => sum + i.property.listPrice, 0);
    const totalPredictedValue = items.reduce(
      (sum, i) => sum + (i.property.predictedPrice || i.property.listPrice), 0
    );

    const potentialGain = totalPredictedValue - totalListValue;
    const potentialGainPct = (potentialGain / totalListValue) * 100;

    const avgInvestmentScore = items.reduce(
      (sum, i) => sum + (i.property.investmentScore || 0), 0
    ) / items.length;

    const avgAppreciation = items.reduce(
      (sum, i) => sum + (i.property.appreciationForecast || 0), 0
    ) / items.length;

    // Property type distribution
    const typeDistribution: Record<string, number> = {};
    items.forEach((i) => {
      const type = i.property.propertyType;
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    });

    // Geographic distribution
    const geoDistribution: Record<string, number> = {};
    items.forEach((i) => {
      const state = i.property.state;
      geoDistribution[state] = (geoDistribution[state] || 0) + 1;
    });

    // Score distribution
    const scoreRanges = {
      'Excellent (80-100)': 0,
      'Good (60-79)': 0,
      'Fair (40-59)': 0,
      'Poor (0-39)': 0,
    };

    items.forEach((i) => {
      const score = i.property.investmentScore || 0;
      if (score >= 80) scoreRanges['Excellent (80-100)']++;
      else if (score >= 60) scoreRanges['Good (60-79)']++;
      else if (score >= 40) scoreRanges['Fair (40-59)']++;
      else scoreRanges['Poor (0-39)']++;
    });

    res.json({
      success: true,
      data: {
        portfolioId: id,
        propertyCount: items.length,
        valuation: {
          totalListValue,
          totalPredictedValue,
          potentialGain,
          potentialGainPercent: parseFloat(potentialGainPct.toFixed(2)),
        },
        scores: {
          averageInvestmentScore: Math.round(avgInvestmentScore),
          averageAppreciation: parseFloat(avgAppreciation.toFixed(2)),
        },
        distribution: {
          byPropertyType: typeDistribution,
          byState: geoDistribution,
          byScoreRange: scoreRanges,
        },
        topPerformers: items
          .sort((a, b) => (b.property.investmentScore || 0) - (a.property.investmentScore || 0))
          .slice(0, 3)
          .map((i) => ({
            propertyId: i.propertyId,
            address: i.property.address,
            city: i.property.city,
            investmentScore: i.property.investmentScore,
          })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/portfolio/alerts - Create a price alert
router.post('/alerts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const schema = z.object({
      type: z.enum(['PRICE_DROP', 'NEW_LISTING', 'INVESTMENT_OPPORTUNITY', 'MARKET_UPDATE']),
      title: z.string().max(200),
      message: z.string().max(1000),
      data: z.record(z.any()).optional(),
    });

    const input = schema.parse(req.body);

    const alert = await prisma.alert.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data,
      },
    });

    // Send real-time notification
    io.to(`user:${userId}`).emit('alert', alert);

    res.status(201).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/portfolio/alerts - Get user alerts
router.get('/alerts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const unreadOnly = req.query.unread === 'true';

    const where: any = { userId };
    if (unreadOnly) {
      where.read = false;
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: alerts,
      unreadCount: alerts.filter((a) => !a.read).length,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/portfolio/alerts/:id/read - Mark alert as read
router.patch('/alerts/:id/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const alert = await prisma.alert.updateMany({
      where: { id, userId },
      data: { read: true },
    });

    res.json({ success: true, message: 'Alert marked as read' });
  } catch (error) {
    next(error);
  }
});

export default router;
