import { Link } from 'react-router-dom';
import { MapPin, Bed, Bath, Square, TrendingUp } from 'lucide-react';

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  listPrice: number;
  predictedPrice?: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  investmentScore?: number;
  appreciationForecast?: number;
  daysOnMarket?: number;
}

interface PropertyCardProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyCardProps) {
  const potentialUpside = property.predictedPrice
    ? ((property.predictedPrice - property.listPrice) / property.listPrice) * 100
    : null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-amber-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Link
      to={`/properties/${property.id}`}
      className="block bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden"
    >
      {/* Property Image Placeholder */}
      <div className="h-40 bg-gradient-to-br from-gray-200 to-gray-300 relative">
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <Square className="w-12 h-12" />
        </div>

        {/* Investment Score Badge */}
        {property.investmentScore && (
          <div className="absolute top-3 right-3">
            <div
              className={`${getScoreColor(
                property.investmentScore
              )} text-white px-2 py-1 rounded-full text-sm font-bold`}
            >
              {property.investmentScore}
            </div>
          </div>
        )}

        {/* Days on Market */}
        {property.daysOnMarket !== undefined && (
          <div className="absolute bottom-3 left-3 bg-black/70 text-white px-2 py-1 rounded text-xs">
            {property.daysOnMarket} days
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Price */}
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xl font-bold text-gray-900">
            ${property.listPrice.toLocaleString()}
          </span>
          {potentialUpside !== null && (
            <span
              className={`text-sm font-medium flex items-center ${
                potentialUpside > 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              {potentialUpside > 0 ? '+' : ''}
              {potentialUpside.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Address */}
        <div className="flex items-start text-gray-600 mb-3">
          <MapPin className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
          <span className="text-sm">
            {property.address}, {property.city}, {property.state}{' '}
            {property.zipCode}
          </span>
        </div>

        {/* Property Details */}
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center">
            <Bed className="w-4 h-4 mr-1" />
            {property.bedrooms} bd
          </div>
          <div className="flex items-center">
            <Bath className="w-4 h-4 mr-1" />
            {property.bathrooms} ba
          </div>
          <div className="flex items-center">
            <Square className="w-4 h-4 mr-1" />
            {property.sqft.toLocaleString()} sqft
          </div>
        </div>

        {/* Appreciation Forecast */}
        {property.appreciationForecast && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">12-mo Forecast</span>
              <span className="font-medium text-green-600">
                +{property.appreciationForecast.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
