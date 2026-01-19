import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Home,
  DollarSign,
  MapPin,
  ArrowUp,
  ArrowDown,
  Star,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import InvestmentScoreCard from '../components/InvestmentScoreCard';
import PropertyCard from '../components/PropertyCard';

export default function Dashboard() {
  const { data: opportunities, isLoading: loadingOpportunities } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => api.get('/market/opportunities?limit=6'),
  });

  const { data: portfolioData, isLoading: loadingPortfolio } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api.get('/portfolio'),
  });

  const stats = [
    {
      label: 'Properties Tracked',
      value: portfolioData?.data?.[0]?.items?.length || 0,
      icon: Home,
      change: '+3 this week',
      trend: 'up',
    },
    {
      label: 'Avg Investment Score',
      value: portfolioData?.data?.[0]?.metrics?.averageInvestmentScore || 0,
      icon: Star,
      change: '+5 pts',
      trend: 'up',
    },
    {
      label: 'Portfolio Value',
      value: formatCurrency(portfolioData?.data?.[0]?.metrics?.totalValue || 0),
      icon: DollarSign,
      change: '+8.2%',
      trend: 'up',
    },
    {
      label: 'Markets Watched',
      value: '4',
      icon: MapPin,
      change: 'TX, CA, FL, AZ',
      trend: 'neutral',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Track your investment opportunities and market trends
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stat.value}
                </p>
                <div className="flex items-center mt-1">
                  {stat.trend === 'up' && (
                    <ArrowUp className="w-4 h-4 text-green-500 mr-1" />
                  )}
                  {stat.trend === 'down' && (
                    <ArrowDown className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  <span
                    className={`text-sm ${
                      stat.trend === 'up'
                        ? 'text-green-600'
                        : stat.trend === 'down'
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {stat.change}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <stat.icon className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Top Investment Opportunities */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Top Investment Opportunities
            </h2>
            <p className="text-sm text-gray-600">
              Properties with the highest investment scores
            </p>
          </div>
          <Link
            to="/search?sort=investmentScore"
            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            View all
          </Link>
        </div>

        {loadingOpportunities ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities?.data?.slice(0, 6).map((property: any) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </div>

      {/* Market Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Trends */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Market Trends
          </h2>
          <div className="space-y-4">
            {[
              { market: 'Austin, TX', trend: 8.5, status: 'hot' },
              { market: 'Dallas, TX', trend: 9.2, status: 'hot' },
              { market: 'San Antonio, TX', trend: 5.5, status: 'warm' },
              { market: 'Houston, TX', trend: 4.8, status: 'neutral' },
            ].map((item) => (
              <div
                key={item.market}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-medium text-gray-900">
                    {item.market}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span
                    className={`text-sm font-medium ${
                      item.trend > 7
                        ? 'text-green-600'
                        : item.trend > 5
                        ? 'text-amber-600'
                        : 'text-gray-600'
                    }`}
                  >
                    +{item.trend}% YoY
                  </span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      item.status === 'hot'
                        ? 'bg-red-100 text-red-700'
                        : item.status === 'warm'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Link
            to="/heatmap"
            className="inline-flex items-center text-sm text-amber-600 hover:text-amber-700 mt-4"
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            View Market Heatmap
          </Link>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Alerts
          </h2>
          <div className="space-y-3">
            <div className="flex items-start p-3 bg-green-50 rounded-lg">
              <div className="p-2 bg-green-100 rounded-full mr-3">
                <Star className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  High-Score Property Found
                </p>
                <p className="text-sm text-gray-600">
                  New property with investment score of 88 in Houston
                </p>
                <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start p-3 bg-amber-50 rounded-lg">
              <div className="p-2 bg-amber-100 rounded-full mr-3">
                <DollarSign className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Price Reduction</p>
                <p className="text-sm text-gray-600">
                  123 Oak Street reduced by $25,000
                </p>
                <p className="text-xs text-gray-400 mt-1">5 hours ago</p>
              </div>
            </div>
            <div className="flex items-start p-3 bg-blue-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-full mr-3">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Market Update</p>
                <p className="text-sm text-gray-600">
                  Austin market appreciation forecast increased to 6.5%
                </p>
                <p className="text-xs text-gray-400 mt-1">1 day ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
}
