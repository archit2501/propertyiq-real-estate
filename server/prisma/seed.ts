import { PrismaClient, PropertyType, ListingStatus, MarketTemperature, DemandLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding PropertyIQ database...');

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@propertyiq.com' },
    update: {},
    create: {
      email: 'demo@propertyiq.com',
      password: hashedPassword,
      name: 'Demo Investor',
    },
  });

  console.log('Created user:', user.email);

  // Create sample properties
  const properties = [
    {
      address: '123 Oak Street',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      latitude: 30.2672,
      longitude: -97.7431,
      propertyType: PropertyType.SINGLE_FAMILY,
      bedrooms: 4,
      bathrooms: 2.5,
      sqft: 2200,
      lotSize: 7500,
      yearBuilt: 2015,
      stories: 2,
      garage: 2,
      pool: false,
      listPrice: 650000,
      predictedPrice: 695000,
      pricePerSqft: 295.45,
      investmentScore: 82,
      riskScore: 35,
      appreciationForecast: 6.5,
      rentalYield: 5.2,
      daysOnMarket: 12,
      status: ListingStatus.ACTIVE,
    },
    {
      address: '456 Maple Avenue',
      city: 'Austin',
      state: 'TX',
      zipCode: '78702',
      latitude: 30.2621,
      longitude: -97.7222,
      propertyType: PropertyType.CONDO,
      bedrooms: 2,
      bathrooms: 2,
      sqft: 1200,
      lotSize: 0,
      yearBuilt: 2020,
      stories: 1,
      garage: 1,
      pool: true,
      listPrice: 425000,
      predictedPrice: 448000,
      pricePerSqft: 354.17,
      investmentScore: 75,
      riskScore: 40,
      appreciationForecast: 5.8,
      rentalYield: 4.8,
      daysOnMarket: 21,
      status: ListingStatus.ACTIVE,
    },
    {
      address: '789 Cedar Lane',
      city: 'San Antonio',
      state: 'TX',
      zipCode: '78205',
      latitude: 29.4241,
      longitude: -98.4936,
      propertyType: PropertyType.TOWNHOUSE,
      bedrooms: 3,
      bathrooms: 2,
      sqft: 1650,
      lotSize: 2000,
      yearBuilt: 2018,
      stories: 2,
      garage: 2,
      pool: false,
      listPrice: 385000,
      predictedPrice: 410000,
      pricePerSqft: 233.33,
      investmentScore: 78,
      riskScore: 38,
      appreciationForecast: 5.2,
      rentalYield: 5.5,
      daysOnMarket: 8,
      status: ListingStatus.ACTIVE,
    },
    {
      address: '101 Pine Court',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75201',
      latitude: 32.7767,
      longitude: -96.7970,
      propertyType: PropertyType.SINGLE_FAMILY,
      bedrooms: 5,
      bathrooms: 3.5,
      sqft: 3500,
      lotSize: 12000,
      yearBuilt: 2010,
      stories: 2,
      garage: 3,
      pool: true,
      listPrice: 925000,
      predictedPrice: 985000,
      pricePerSqft: 264.29,
      investmentScore: 85,
      riskScore: 30,
      appreciationForecast: 7.2,
      rentalYield: 4.5,
      daysOnMarket: 5,
      status: ListingStatus.ACTIVE,
    },
    {
      address: '202 Elm Street',
      city: 'Houston',
      state: 'TX',
      zipCode: '77002',
      latitude: 29.7604,
      longitude: -95.3698,
      propertyType: PropertyType.MULTI_FAMILY,
      bedrooms: 6,
      bathrooms: 4,
      sqft: 3200,
      lotSize: 5000,
      yearBuilt: 1985,
      stories: 2,
      garage: 2,
      pool: false,
      listPrice: 550000,
      predictedPrice: 590000,
      pricePerSqft: 171.88,
      investmentScore: 88,
      riskScore: 42,
      appreciationForecast: 4.8,
      rentalYield: 7.2,
      daysOnMarket: 15,
      status: ListingStatus.ACTIVE,
    },
  ];

  for (const property of properties) {
    await prisma.property.create({ data: property });
  }

  console.log('Created properties:', properties.length);

  // Create market metrics
  const marketMetrics = [
    {
      zipCode: '78701',
      city: 'Austin',
      state: 'TX',
      medianPrice: 625000,
      medianPriceChange: 8.5,
      inventoryLevel: 245,
      daysOnMarketAvg: 18,
      priceToRentRatio: 22.5,
      appreciation1y: 8.5,
      appreciation5y: 45.2,
      forecast12m: 6.5,
      marketTemperature: MarketTemperature.HOT,
      buyerDemand: DemandLevel.VERY_HIGH,
      sellerSupply: DemandLevel.LOW,
    },
    {
      zipCode: '78702',
      city: 'Austin',
      state: 'TX',
      medianPrice: 550000,
      medianPriceChange: 7.2,
      inventoryLevel: 320,
      daysOnMarketAvg: 22,
      priceToRentRatio: 21.0,
      appreciation1y: 7.2,
      appreciation5y: 42.0,
      forecast12m: 5.8,
      marketTemperature: MarketTemperature.WARM,
      buyerDemand: DemandLevel.HIGH,
      sellerSupply: DemandLevel.MODERATE,
    },
    {
      zipCode: '78205',
      city: 'San Antonio',
      state: 'TX',
      medianPrice: 375000,
      medianPriceChange: 5.5,
      inventoryLevel: 450,
      daysOnMarketAvg: 28,
      priceToRentRatio: 18.5,
      appreciation1y: 5.5,
      appreciation5y: 32.0,
      forecast12m: 5.2,
      marketTemperature: MarketTemperature.WARM,
      buyerDemand: DemandLevel.HIGH,
      sellerSupply: DemandLevel.MODERATE,
    },
    {
      zipCode: '75201',
      city: 'Dallas',
      state: 'TX',
      medianPrice: 850000,
      medianPriceChange: 9.2,
      inventoryLevel: 180,
      daysOnMarketAvg: 14,
      priceToRentRatio: 24.0,
      appreciation1y: 9.2,
      appreciation5y: 52.0,
      forecast12m: 7.2,
      marketTemperature: MarketTemperature.HOT,
      buyerDemand: DemandLevel.VERY_HIGH,
      sellerSupply: DemandLevel.VERY_LOW,
    },
    {
      zipCode: '77002',
      city: 'Houston',
      state: 'TX',
      medianPrice: 520000,
      medianPriceChange: 4.8,
      inventoryLevel: 520,
      daysOnMarketAvg: 32,
      priceToRentRatio: 16.5,
      appreciation1y: 4.8,
      appreciation5y: 28.0,
      forecast12m: 4.5,
      marketTemperature: MarketTemperature.NEUTRAL,
      buyerDemand: DemandLevel.MODERATE,
      sellerSupply: DemandLevel.HIGH,
    },
  ];

  for (const metrics of marketMetrics) {
    await prisma.marketMetrics.create({ data: metrics });
  }

  console.log('Created market metrics:', marketMetrics.length);

  // Create neighborhoods
  const neighborhoods = [
    {
      name: 'Downtown',
      city: 'Austin',
      state: 'TX',
      walkScore: 92,
      transitScore: 78,
      bikeScore: 85,
      schoolRating: 7.5,
      crimeIndex: 45.2,
      medianIncome: 95000,
      population: 12500,
      populationGrowth: 4.2,
      medianAge: 32.5,
      restaurants: 250,
      groceryStores: 15,
      parks: 8,
      hospitals: 3,
    },
    {
      name: 'East Austin',
      city: 'Austin',
      state: 'TX',
      walkScore: 78,
      transitScore: 62,
      bikeScore: 72,
      schoolRating: 6.8,
      crimeIndex: 52.1,
      medianIncome: 72000,
      population: 18000,
      populationGrowth: 5.8,
      medianAge: 29.5,
      restaurants: 180,
      groceryStores: 12,
      parks: 12,
      hospitals: 2,
    },
    {
      name: 'River Walk',
      city: 'San Antonio',
      state: 'TX',
      walkScore: 88,
      transitScore: 65,
      bikeScore: 68,
      schoolRating: 7.0,
      crimeIndex: 48.5,
      medianIncome: 68000,
      population: 8500,
      populationGrowth: 2.5,
      medianAge: 35.0,
      restaurants: 320,
      groceryStores: 8,
      parks: 6,
      hospitals: 4,
    },
  ];

  for (const neighborhood of neighborhoods) {
    await prisma.neighborhood.create({ data: neighborhood });
  }

  console.log('Created neighborhoods:', neighborhoods.length);

  // Create portfolio for demo user
  const portfolio = await prisma.portfolio.create({
    data: {
      userId: user.id,
      name: 'Investment Watchlist',
      description: 'Properties I\'m tracking for potential investment',
    },
  });

  console.log('Created portfolio:', portfolio.name);

  // Add properties to portfolio
  const allProperties = await prisma.property.findMany({ take: 3 });
  for (const property of allProperties) {
    await prisma.portfolioItem.create({
      data: {
        portfolioId: portfolio.id,
        propertyId: property.id,
        alertEnabled: true,
      },
    });
  }

  console.log('Added properties to portfolio');

  // Create sample alerts
  await prisma.alert.create({
    data: {
      userId: user.id,
      type: 'INVESTMENT_OPPORTUNITY',
      title: 'High-Score Property Alert',
      message: 'New property with investment score of 88 found in Houston.',
      read: false,
    },
  });

  await prisma.alert.create({
    data: {
      userId: user.id,
      type: 'PRICE_DROP',
      title: 'Price Reduction',
      message: 'Property at 123 Oak Street reduced by $25,000',
      read: false,
    },
  });

  console.log('Created sample alerts');

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
