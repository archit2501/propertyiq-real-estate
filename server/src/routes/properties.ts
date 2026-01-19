import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { redis } from '../utils/redis';
import { logger } from '../utils/logger';

// Property type and listing status values
const PropertyType = {
  SINGLE_FAMILY: 'SINGLE_FAMILY',
  CONDO: 'CONDO',
  TOWNHOUSE: 'TOWNHOUSE',
  MULTI_FAMILY: 'MULTI_FAMILY',
  LAND: 'LAND',
  COMMERCIAL: 'COMMERCIAL',
} as const;

const ListingStatus = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  SOLD: 'SOLD',
  OFF_MARKET: 'OFF_MARKET',
} as const;

const router = Router();
const prisma = new PrismaClient();

// Search schema
const searchSchema = z.object({
  city: z.string().optional(),
  state: z.string().length(2).optional(),
  zipCode: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minBeds: z.coerce.number().optional(),
  maxBeds: z.coerce.number().optional(),
  minBaths: z.coerce.number().optional(),
  minSqft: z.coerce.number().optional(),
  maxSqft: z.coerce.number().optional(),
  propertyType: z.enum(['SINGLE_FAMILY', 'CONDO', 'TOWNHOUSE', 'MULTI_FAMILY', 'LAND', 'COMMERCIAL']).optional(),
  status: z.enum(['ACTIVE', 'PENDING', 'SOLD', 'OFF_MARKET']).optional(),
  minInvestmentScore: z.coerce.number().min(0).max(100).optional(),
  sortBy: z.enum(['price', 'investmentScore', 'daysOnMarket', 'pricePerSqft']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  // Geo search
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().optional(), // miles
});

// GET /api/properties - Search properties
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = searchSchema.parse(req.query);
    const { page, limit, sortBy, sortOrder, lat, lng, radius, ...filters } = params;

    // Build where clause
    const where: any = {};

    if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
    if (filters.state) where.state = filters.state.toUpperCase();
    if (filters.zipCode) where.zipCode = filters.zipCode;
    if (filters.propertyType) where.propertyType = filters.propertyType;
    if (filters.status) where.status = filters.status;

    if (filters.minPrice || filters.maxPrice) {
      where.listPrice = {};
      if (filters.minPrice) where.listPrice.gte = filters.minPrice;
      if (filters.maxPrice) where.listPrice.lte = filters.maxPrice;
    }

    if (filters.minBeds || filters.maxBeds) {
      where.bedrooms = {};
      if (filters.minBeds) where.bedrooms.gte = filters.minBeds;
      if (filters.maxBeds) where.bedrooms.lte = filters.maxBeds;
    }

    if (filters.minBaths) where.bathrooms = { gte: filters.minBaths };

    if (filters.minSqft || filters.maxSqft) {
      where.sqft = {};
      if (filters.minSqft) where.sqft.gte = filters.minSqft;
      if (filters.maxSqft) where.sqft.lte = filters.maxSqft;
    }

    if (filters.minInvestmentScore) {
      where.investmentScore = { gte: filters.minInvestmentScore };
    }

    // Build order by
    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // Execute query
    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.property.count({ where }),
    ]);

    res.json({
      success: true,
      data: properties,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/properties/:id - Get property details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check cache first
    const cached = await redis.get(`property:${id}`);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        comparables: {
          orderBy: { similarity: 'desc' },
          take: 10,
        },
        predictions: {
          orderBy: { predictionDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    // Cache for 30 minutes
    await redis.setex(`property:${id}`, 1800, JSON.stringify(property));

    res.json({ success: true, data: property });
  } catch (error) {
    next(error);
  }
});

// GET /api/properties/:id/predict - Get price prediction
router.get('/:id/predict', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    // Call ML service
    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

    const response = await axios.post(`${mlServiceUrl}/predict`, {
      property_id: id,
      features: {
        sqft: property.sqft,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        year_built: property.yearBuilt,
        lot_size: property.lotSize,
        property_type: property.propertyType,
        latitude: property.latitude,
        longitude: property.longitude,
        zip_code: property.zipCode,
      },
    });

    const prediction = response.data;

    // Save prediction to database
    await prisma.pricePrediction.create({
      data: {
        propertyId: id,
        predictedPrice: prediction.predicted_price,
        confidenceLow: prediction.confidence_interval.low,
        confidenceHigh: prediction.confidence_interval.high,
        modelVersion: prediction.model_version,
        features: prediction.feature_importance,
        targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year ahead
      },
    });

    // Update property with new prediction
    await prisma.property.update({
      where: { id },
      data: {
        predictedPrice: prediction.predicted_price,
        appreciationForecast: prediction.appreciation_forecast,
      },
    });

    res.json({
      success: true,
      data: {
        propertyId: id,
        currentPrice: property.listPrice,
        predictedPrice: prediction.predicted_price,
        confidenceInterval: prediction.confidence_interval,
        appreciationForecast: prediction.appreciation_forecast,
        featureImportance: prediction.feature_importance,
        modelVersion: prediction.model_version,
      },
    });
  } catch (error) {
    logger.error('Prediction error:', error);
    next(error);
  }
});

// GET /api/properties/:id/comps - Get comparable properties
router.get('/:id/comps', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    // Get existing comps
    const comps = await prisma.comparable.findMany({
      where: { propertyId: id },
      orderBy: { similarity: 'desc' },
      take: limit,
    });

    if (comps.length > 0) {
      return res.json({ success: true, data: comps });
    }

    // If no comps, fetch from ML service
    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

    const response = await axios.post(`${mlServiceUrl}/comps`, {
      property_id: id,
      latitude: property.latitude,
      longitude: property.longitude,
      sqft: property.sqft,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      property_type: property.propertyType,
      limit,
    });

    res.json({
      success: true,
      data: response.data.comparables,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/properties/:id/investment-score - Get investment analysis
router.get('/:id/investment-score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    // Get market data
    const marketMetrics = await prisma.marketMetrics.findUnique({
      where: { zipCode: property.zipCode },
    });

    // Call ML service for investment score
    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

    const response = await axios.post(`${mlServiceUrl}/investment-score`, {
      property_id: id,
      list_price: property.listPrice,
      predicted_price: property.predictedPrice,
      sqft: property.sqft,
      appreciation_forecast: property.appreciationForecast,
      market_metrics: marketMetrics,
    });

    const score = response.data;

    // Update property
    await prisma.property.update({
      where: { id },
      data: {
        investmentScore: score.overall_score,
        riskScore: score.risk_score,
      },
    });

    res.json({
      success: true,
      data: {
        propertyId: id,
        overallScore: score.overall_score,
        components: {
          appreciationPotential: score.appreciation_score,
          cashFlowScore: score.cash_flow_score,
          riskAdjustedReturn: score.risk_adjusted_score,
          marketMomentum: score.market_momentum_score,
          liquidityScore: score.liquidity_score,
        },
        riskLevel: score.risk_level,
        recommendation: score.recommendation,
        factors: score.key_factors,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
