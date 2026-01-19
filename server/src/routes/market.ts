import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { redis } from '../utils/redis';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// GET /api/market/heatmap - Get heatmap data
router.get('/heatmap', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      layer: z.enum(['appreciation', 'rental_yield', 'investment_score', 'days_on_market', 'price_per_sqft']).default('appreciation'),
      state: z.string().length(2).optional(),
      bounds: z.object({
        north: z.coerce.number(),
        south: z.coerce.number(),
        east: z.coerce.number(),
        west: z.coerce.number(),
      }).optional(),
    });

    const params = schema.parse(req.query);

    // Check cache
    const cacheKey = `heatmap:${params.layer}:${params.state || 'all'}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    // Get market metrics by zip code
    const where: any = {};
    if (params.state) {
      where.state = params.state.toUpperCase();
    }

    const marketData = await prisma.marketMetrics.findMany({
      where,
      select: {
        zipCode: true,
        city: true,
        state: true,
        medianPrice: true,
        medianPriceChange: true,
        appreciation1y: true,
        forecast12m: true,
        daysOnMarketAvg: true,
        priceToRentRatio: true,
        marketTemperature: true,
      },
    });

    // Calculate aggregate values per zip for the selected layer
    const heatmapData = marketData.map((m) => {
      let value: number;
      switch (params.layer) {
        case 'appreciation':
          value = m.appreciation1y;
          break;
        case 'rental_yield':
          value = m.priceToRentRatio ? 12 / m.priceToRentRatio : 0;
          break;
        case 'investment_score':
          // Simplified investment score based on appreciation and rental yield
          value = (m.appreciation1y * 50) + ((m.priceToRentRatio ? 12 / m.priceToRentRatio : 0) * 50);
          break;
        case 'days_on_market':
          value = m.daysOnMarketAvg;
          break;
        case 'price_per_sqft':
          value = m.medianPrice / 1500; // Rough estimate
          break;
        default:
          value = m.appreciation1y;
      }

      return {
        zipCode: m.zipCode,
        city: m.city,
        state: m.state,
        value,
        medianPrice: m.medianPrice,
        marketTemperature: m.marketTemperature,
      };
    });

    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(heatmapData));

    res.json({
      success: true,
      data: heatmapData,
      meta: {
        layer: params.layer,
        count: heatmapData.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/market/:zipCode - Get market metrics for a zip code
router.get('/:zipCode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zipCode } = req.params;

    // Check cache
    const cached = await redis.get(`market:${zipCode}`);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    const metrics = await prisma.marketMetrics.findUnique({
      where: { zipCode },
    });

    if (!metrics) {
      return res.status(404).json({ success: false, error: 'Market data not found for this zip code' });
    }

    // Get neighborhood data
    const neighborhood = await prisma.neighborhood.findFirst({
      where: {
        city: metrics.city,
        state: metrics.state,
      },
    });

    // Get recent sales in the area
    const recentSales = await prisma.property.findMany({
      where: {
        zipCode,
        status: 'SOLD',
        lastSoldDate: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        },
      },
      orderBy: { lastSoldDate: 'desc' },
      take: 10,
      select: {
        address: true,
        lastSoldPrice: true,
        lastSoldDate: true,
        sqft: true,
        bedrooms: true,
        bathrooms: true,
      },
    });

    const result = {
      ...metrics,
      neighborhood,
      recentSales,
    };

    // Cache for 24 hours
    await redis.setex(`market:${zipCode}`, 86400, JSON.stringify(result));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/market/trends - Get historical market trends
router.get('/trends/:zipCode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zipCode } = req.params;
    const months = parseInt(req.query.months as string) || 24;

    // In production, this would query a time-series table
    // For demo, we'll generate synthetic trend data
    const metrics = await prisma.marketMetrics.findUnique({
      where: { zipCode },
    });

    if (!metrics) {
      return res.status(404).json({ success: false, error: 'Market data not found' });
    }

    // Generate historical trend data
    const trends: Array<{ date: string; medianPrice: number; inventory: number; daysOnMarket: number }> = [];
    const basePrice = metrics.medianPrice;
    const monthlyGrowth = metrics.appreciation1y / 12 / 100;

    for (let i = months; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      // Add some variance for realistic data
      const variance = (Math.random() - 0.5) * 0.02;
      const multiplier = 1 - (i * monthlyGrowth) + variance;

      trends.push({
        date: date.toISOString().slice(0, 7), // YYYY-MM format
        medianPrice: Math.round(basePrice * multiplier),
        inventory: Math.round(metrics.inventoryLevel * (1 + (Math.random() - 0.5) * 0.3)),
        daysOnMarket: Math.round(metrics.daysOnMarketAvg * (1 + (Math.random() - 0.5) * 0.2)),
      });
    }

    res.json({
      success: true,
      data: {
        zipCode,
        city: metrics.city,
        state: metrics.state,
        trends,
        summary: {
          currentMedianPrice: metrics.medianPrice,
          priceChange1y: metrics.appreciation1y,
          forecast12m: metrics.forecast12m,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/market/neighborhoods/:city - Get neighborhood data for a city
router.get('/neighborhoods/:city', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { city } = req.params;
    const state = req.query.state as string;

    const where: any = {
      city: { contains: city, mode: 'insensitive' },
    };

    if (state) {
      where.state = state.toUpperCase();
    }

    const neighborhoods = await prisma.neighborhood.findMany({
      where,
      orderBy: { walkScore: 'desc' },
    });

    res.json({
      success: true,
      data: neighborhoods,
      count: neighborhoods.length,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/market/opportunities - Get top investment opportunities
router.get('/opportunities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      state: z.string().length(2).optional(),
      city: z.string().optional(),
      minScore: z.coerce.number().min(0).max(100).default(70),
      limit: z.coerce.number().min(1).max(50).default(20),
    });

    const params = schema.parse(req.query);

    const where: any = {
      investmentScore: { gte: params.minScore },
      status: 'ACTIVE',
    };

    if (params.state) where.state = params.state.toUpperCase();
    if (params.city) where.city = { contains: params.city, mode: 'insensitive' };

    const opportunities = await prisma.property.findMany({
      where,
      orderBy: { investmentScore: 'desc' },
      take: params.limit,
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        listPrice: true,
        predictedPrice: true,
        bedrooms: true,
        bathrooms: true,
        sqft: true,
        investmentScore: true,
        appreciationForecast: true,
        rentalYield: true,
        daysOnMarket: true,
      },
    });

    // Calculate potential upside
    const enrichedOpportunities = opportunities.map((p) => ({
      ...p,
      potentialUpside: p.predictedPrice
        ? ((p.predictedPrice - p.listPrice) / p.listPrice * 100).toFixed(2)
        : null,
    }));

    res.json({
      success: true,
      data: enrichedOpportunities,
      meta: {
        count: enrichedOpportunities.length,
        minScore: params.minScore,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
