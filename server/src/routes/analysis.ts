import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// POST /api/analysis/cashflow - Calculate cash flow for a property
router.post('/cashflow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      purchasePrice: z.number().positive(),
      downPaymentPercent: z.number().min(0).max(100).default(20),
      interestRate: z.number().min(0).max(20).default(7),
      loanTermYears: z.number().min(10).max(30).default(30),
      monthlyRent: z.number().positive(),
      otherIncome: z.number().default(0),
      vacancyRate: z.number().min(0).max(100).default(5),
      propertyTax: z.number().default(0),
      insurance: z.number().default(0),
      maintenance: z.number().default(0),
      hoa: z.number().default(0),
      propertyManagementPercent: z.number().min(0).max(100).default(0),
      utilities: z.number().default(0),
    });

    const input = schema.parse(req.body);

    // Calculate loan details
    const downPayment = input.purchasePrice * (input.downPaymentPercent / 100);
    const loanAmount = input.purchasePrice - downPayment;
    const monthlyRate = input.interestRate / 100 / 12;
    const numPayments = input.loanTermYears * 12;

    // Monthly mortgage payment (P&I)
    const monthlyMortgage = loanAmount *
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    // Income calculations
    const effectiveRent = input.monthlyRent * (1 - input.vacancyRate / 100);
    const totalMonthlyIncome = effectiveRent + input.otherIncome;
    const annualGrossIncome = totalMonthlyIncome * 12;

    // Property management fee
    const propertyManagementFee = totalMonthlyIncome * (input.propertyManagementPercent / 100);

    // Monthly expenses
    const monthlyPropertyTax = input.propertyTax / 12;
    const monthlyInsurance = input.insurance / 12;
    const monthlyMaintenance = input.maintenance / 12;
    const totalMonthlyExpenses = monthlyMortgage + monthlyPropertyTax + monthlyInsurance +
      monthlyMaintenance + input.hoa + propertyManagementFee + input.utilities;

    // Cash flow
    const monthlyCashFlow = totalMonthlyIncome - totalMonthlyExpenses;
    const annualCashFlow = monthlyCashFlow * 12;

    // Returns
    const annualExpenses = totalMonthlyExpenses * 12;
    const noi = annualGrossIncome - (annualExpenses - monthlyMortgage * 12); // NOI excludes mortgage
    const capRate = (noi / input.purchasePrice) * 100;
    const cashOnCash = (annualCashFlow / downPayment) * 100;

    // Total ROI (simplified - first year)
    const principalPaydown = loanAmount * (monthlyRate / (Math.pow(1 + monthlyRate, numPayments) - 1)) * 12;
    const totalROI = ((annualCashFlow + principalPaydown) / downPayment) * 100;

    // Break-even months (to recover down payment from cash flow)
    const breakEvenMonths = monthlyCashFlow > 0
      ? Math.ceil(downPayment / monthlyCashFlow)
      : null;

    // DSCR (Debt Service Coverage Ratio)
    const dscr = noi / (monthlyMortgage * 12);

    // Save analysis
    const analysis = await prisma.cashFlowAnalysis.create({
      data: {
        purchasePrice: input.purchasePrice,
        downPayment: input.downPaymentPercent,
        interestRate: input.interestRate,
        loanTermYears: input.loanTermYears,
        monthlyRent: input.monthlyRent,
        otherIncome: input.otherIncome,
        vacancyRate: input.vacancyRate,
        propertyTax: input.propertyTax,
        insurance: input.insurance,
        maintenance: input.maintenance,
        hoa: input.hoa,
        propertyManagement: input.propertyManagementPercent,
        utilities: input.utilities,
        monthlyCashFlow: Math.round(monthlyCashFlow),
        annualCashFlow: Math.round(annualCashFlow),
        capRate: parseFloat(capRate.toFixed(2)),
        cashOnCash: parseFloat(cashOnCash.toFixed(2)),
        totalROI: parseFloat(totalROI.toFixed(2)),
        breakEvenMonths,
      },
    });

    res.json({
      success: true,
      data: {
        id: analysis.id,
        summary: {
          purchasePrice: input.purchasePrice,
          downPayment,
          loanAmount,
          monthlyMortgage: Math.round(monthlyMortgage),
        },
        income: {
          monthlyRent: input.monthlyRent,
          effectiveRent: Math.round(effectiveRent),
          otherIncome: input.otherIncome,
          totalMonthlyIncome: Math.round(totalMonthlyIncome),
          annualGrossIncome: Math.round(annualGrossIncome),
        },
        expenses: {
          mortgage: Math.round(monthlyMortgage),
          propertyTax: Math.round(monthlyPropertyTax),
          insurance: Math.round(monthlyInsurance),
          maintenance: Math.round(monthlyMaintenance),
          hoa: input.hoa,
          propertyManagement: Math.round(propertyManagementFee),
          utilities: input.utilities,
          totalMonthly: Math.round(totalMonthlyExpenses),
          totalAnnual: Math.round(annualExpenses),
        },
        cashFlow: {
          monthly: Math.round(monthlyCashFlow),
          annual: Math.round(annualCashFlow),
        },
        returns: {
          capRate: parseFloat(capRate.toFixed(2)),
          cashOnCash: parseFloat(cashOnCash.toFixed(2)),
          totalROI: parseFloat(totalROI.toFixed(2)),
          noi: Math.round(noi),
          dscr: parseFloat(dscr.toFixed(2)),
        },
        analysis: {
          breakEvenMonths,
          breakEvenYears: breakEvenMonths ? parseFloat((breakEvenMonths / 12).toFixed(1)) : null,
          isPositiveCashFlow: monthlyCashFlow > 0,
          recommendation: getCashFlowRecommendation(capRate, cashOnCash, dscr),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/analysis/investment-score - Calculate investment score
router.post('/investment-score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      propertyId: z.string().uuid().optional(),
      listPrice: z.number().positive(),
      predictedPrice: z.number().positive().optional(),
      appreciationForecast: z.number().optional(),
      rentalYield: z.number().optional(),
      daysOnMarket: z.number().optional(),
      zipCode: z.string(),
    });

    const input = schema.parse(req.body);

    // Get market data
    const marketMetrics = await prisma.marketMetrics.findUnique({
      where: { zipCode: input.zipCode },
    });

    // Calculate component scores (0-100 each)
    let appreciationScore = 50;
    let cashFlowScore = 50;
    let marketMomentumScore = 50;
    let liquidityScore = 50;
    let riskScore = 50;

    // Appreciation potential
    if (input.predictedPrice && input.listPrice) {
      const upside = ((input.predictedPrice - input.listPrice) / input.listPrice) * 100;
      appreciationScore = Math.min(100, Math.max(0, 50 + upside * 5));
    }
    if (input.appreciationForecast) {
      appreciationScore = Math.min(100, (appreciationScore + input.appreciationForecast * 5) / 2);
    }

    // Cash flow score based on rental yield
    if (input.rentalYield) {
      cashFlowScore = Math.min(100, input.rentalYield * 10);
    }

    // Market momentum
    if (marketMetrics) {
      marketMomentumScore = Math.min(100, Math.max(0, 50 + marketMetrics.appreciation1y * 3));

      // Liquidity score based on days on market
      if (marketMetrics.daysOnMarketAvg) {
        liquidityScore = Math.max(0, 100 - marketMetrics.daysOnMarketAvg);
      }

      // Risk score (inverse - lower is better)
      const marketTemp = marketMetrics.marketTemperature;
      const tempScores: Record<string, number> = {
        'HOT': 30,
        'WARM': 40,
        'NEUTRAL': 50,
        'COOL': 60,
        'COLD': 70,
      };
      riskScore = tempScores[marketTemp] || 50;
    }

    // Days on market affects liquidity
    if (input.daysOnMarket !== undefined) {
      liquidityScore = Math.max(0, 100 - input.daysOnMarket * 0.5);
    }

    // Calculate weighted overall score
    const weights = {
      appreciation: 0.30,
      cashFlow: 0.25,
      riskAdjusted: 0.20,
      marketMomentum: 0.15,
      liquidity: 0.10,
    };

    const riskAdjustedScore = (appreciationScore + cashFlowScore) / 2 * (1 - riskScore / 200);

    const overallScore = Math.round(
      appreciationScore * weights.appreciation +
      cashFlowScore * weights.cashFlow +
      riskAdjustedScore * weights.riskAdjusted +
      marketMomentumScore * weights.marketMomentum +
      liquidityScore * weights.liquidity
    );

    // Get recommendation
    const recommendation = getInvestmentRecommendation(overallScore, appreciationScore, cashFlowScore, riskScore);

    res.json({
      success: true,
      data: {
        overallScore,
        components: {
          appreciationPotential: Math.round(appreciationScore),
          cashFlowScore: Math.round(cashFlowScore),
          riskAdjustedReturn: Math.round(riskAdjustedScore),
          marketMomentum: Math.round(marketMomentumScore),
          liquidityScore: Math.round(liquidityScore),
        },
        riskLevel: getRiskLevel(riskScore),
        recommendation,
        weights,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/analysis/compare - Compare multiple properties
router.post('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      propertyIds: z.array(z.string().uuid()).min(2).max(5),
    });

    const { propertyIds } = schema.parse(req.body);

    const properties = await prisma.property.findMany({
      where: {
        id: { in: propertyIds },
      },
    });

    if (properties.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 valid properties required for comparison',
      });
    }

    // Calculate comparison metrics
    const comparison = properties.map((p) => ({
      id: p.id,
      address: p.address,
      city: p.city,
      state: p.state,
      listPrice: p.listPrice,
      predictedPrice: p.predictedPrice,
      pricePerSqft: p.pricePerSqft,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      sqft: p.sqft,
      yearBuilt: p.yearBuilt,
      investmentScore: p.investmentScore,
      appreciationForecast: p.appreciationForecast,
      rentalYield: p.rentalYield,
      daysOnMarket: p.daysOnMarket,
      potentialUpside: p.predictedPrice
        ? ((p.predictedPrice - p.listPrice) / p.listPrice * 100).toFixed(2)
        : null,
    }));

    // Calculate averages
    const avgPrice = properties.reduce((sum, p) => sum + p.listPrice, 0) / properties.length;
    const avgScore = properties.reduce((sum, p) => sum + (p.investmentScore || 0), 0) / properties.length;
    const avgPricePerSqft = properties.reduce((sum, p) => sum + (p.pricePerSqft || 0), 0) / properties.length;

    // Determine best property for different criteria
    const bestValue = properties.reduce((best, p) =>
      (p.investmentScore || 0) > (best.investmentScore || 0) ? p : best
    );
    const lowestPrice = properties.reduce((best, p) =>
      p.listPrice < best.listPrice ? p : best
    );
    const bestAppreciation = properties.reduce((best, p) =>
      (p.appreciationForecast || 0) > (best.appreciationForecast || 0) ? p : best
    );

    res.json({
      success: true,
      data: {
        properties: comparison,
        summary: {
          averagePrice: Math.round(avgPrice),
          averageInvestmentScore: Math.round(avgScore),
          averagePricePerSqft: Math.round(avgPricePerSqft),
        },
        recommendations: {
          bestOverallValue: bestValue.id,
          lowestPrice: lowestPrice.id,
          bestAppreciationPotential: bestAppreciation.id,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function getCashFlowRecommendation(capRate: number, cashOnCash: number, dscr: number): string {
  if (capRate >= 8 && cashOnCash >= 10 && dscr >= 1.25) {
    return 'Excellent investment opportunity with strong cash flow metrics.';
  }
  if (capRate >= 6 && cashOnCash >= 7 && dscr >= 1.1) {
    return 'Good investment with solid fundamentals. Consider for portfolio diversification.';
  }
  if (capRate >= 4 && cashOnCash >= 4 && dscr >= 1.0) {
    return 'Moderate investment. May be suitable for long-term appreciation focus.';
  }
  if (dscr < 1.0) {
    return 'Negative cash flow property. Only consider if significant appreciation is expected.';
  }
  return 'Below average returns. Consider negotiating a lower purchase price.';
}

function getInvestmentRecommendation(
  overall: number,
  appreciation: number,
  cashFlow: number,
  risk: number
): string {
  if (overall >= 80) {
    return 'Strong Buy - Exceptional investment opportunity with favorable metrics across all categories.';
  }
  if (overall >= 65) {
    return 'Buy - Good investment potential. Consider this property for your portfolio.';
  }
  if (overall >= 50) {
    if (appreciation > 70) {
      return 'Hold/Consider - Moderate overall score but strong appreciation potential for growth investors.';
    }
    if (cashFlow > 70) {
      return 'Hold/Consider - Moderate overall score but strong cash flow for income-focused investors.';
    }
    return 'Hold - Average investment. May be suitable depending on specific investment goals.';
  }
  if (risk > 70) {
    return 'Avoid - High risk profile with below-average returns.';
  }
  return 'Pass - Below average investment opportunity. Look for better alternatives.';
}

function getRiskLevel(riskScore: number): string {
  if (riskScore <= 30) return 'Low';
  if (riskScore <= 50) return 'Medium-Low';
  if (riskScore <= 70) return 'Medium';
  if (riskScore <= 85) return 'Medium-High';
  return 'High';
}

export default router;
