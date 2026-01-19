import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, SlidersHorizontal, Grid, List } from 'lucide-react';
import { propertyApi } from '../services/api';
import PropertyCard from '../components/PropertyCard';

const PROPERTY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'SINGLE_FAMILY', label: 'Single Family' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOUSE', label: 'Townhouse' },
  { value: 'MULTI_FAMILY', label: 'Multi-Family' },
];

export default function PropertySearch() {
  const [filters, setFilters] = useState({
    city: '',
    state: '',
    minPrice: '',
    maxPrice: '',
    minBeds: '',
    minBaths: '',
    minSqft: '',
    propertyType: '',
    minInvestmentScore: '',
    sortBy: 'investmentScore',
    sortOrder: 'desc' as const,
  });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data, isLoading } = useQuery({
    queryKey: ['properties', filters, page],
    queryFn: () =>
      propertyApi.search({
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        ),
        page,
        limit: 12,
      }),
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Search</h1>
          <p className="text-gray-600">
            Find investment properties with ML-powered insights
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${
              viewMode === 'grid'
                ? 'bg-amber-100 text-amber-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${
              viewMode === 'list'
                ? 'bg-amber-100 text-amber-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by city, state, or zip code..."
            value={filters.city}
            onChange={(e) => handleFilterChange('city', e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-3 border rounded-lg flex items-center space-x-2 transition-colors ${
            showFilters
              ? 'border-amber-500 text-amber-600 bg-amber-50'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
          <span>Filters</span>
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Price
              </label>
              <input
                type="number"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                placeholder="$0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Price
              </label>
              <input
                type="number"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                placeholder="No limit"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Beds & Baths */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Beds
              </label>
              <select
                value={filters.minBeds}
                onChange={(e) => handleFilterChange('minBeds', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Any</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Baths
              </label>
              <select
                value={filters.minBaths}
                onChange={(e) => handleFilterChange('minBaths', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Any</option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </select>
            </div>

            {/* Property Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Type
              </label>
              <select
                value={filters.propertyType}
                onChange={(e) =>
                  handleFilterChange('propertyType', e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                {PROPERTY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Min Sqft */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Sqft
              </label>
              <input
                type="number"
                value={filters.minSqft}
                onChange={(e) => handleFilterChange('minSqft', e.target.value)}
                placeholder="Any"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Investment Score */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Investment Score
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.minInvestmentScore}
                onChange={(e) =>
                  handleFilterChange('minInvestmentScore', e.target.value)
                }
                placeholder="0-100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option value="investmentScore">Investment Score</option>
                <option value="price">Price</option>
                <option value="daysOnMarket">Days on Market</option>
                <option value="pricePerSqft">Price per Sqft</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
        </div>
      ) : (
        <>
          {/* Results Count */}
          <div className="text-sm text-gray-600">
            {data?.pagination?.total || 0} properties found
          </div>

          {/* Property Grid */}
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'space-y-4'
            }
          >
            {data?.data?.map((property: any) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>

          {/* Pagination */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="flex justify-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-600">
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                onClick={() =>
                  setPage((p) => Math.min(data.pagination.totalPages, p + 1))
                }
                disabled={page === data.pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
