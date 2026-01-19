import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axiosInstance.defaults.headers.common['Authorization'];
  }
}

// Initialize from localStorage
const storedToken = localStorage.getItem('token');
if (storedToken) {
  setAuthToken(storedToken);
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function handleRequest<T>(
  request: Promise<{ data: ApiResponse<T> }>
): Promise<ApiResponse<T>> {
  try {
    const response = await request;
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ApiResponse>;
    if (axiosError.response?.data) {
      return axiosError.response.data;
    }
    return {
      success: false,
      error: axiosError.message || 'An error occurred',
    };
  }
}

export const api = {
  get: <T = any>(url: string, params?: object) =>
    handleRequest<T>(axiosInstance.get(url, { params })),

  post: <T = any>(url: string, data?: object) =>
    handleRequest<T>(axiosInstance.post(url, data)),

  put: <T = any>(url: string, data?: object) =>
    handleRequest<T>(axiosInstance.put(url, data)),

  patch: <T = any>(url: string, data?: object) =>
    handleRequest<T>(axiosInstance.patch(url, data)),

  delete: <T = any>(url: string) =>
    handleRequest<T>(axiosInstance.delete(url)),
};

// Property-specific API calls
export const propertyApi = {
  search: (params: {
    city?: string;
    state?: string;
    zipCode?: string;
    minPrice?: number;
    maxPrice?: number;
    minBeds?: number;
    maxBeds?: number;
    minBaths?: number;
    minSqft?: number;
    maxSqft?: number;
    propertyType?: string;
    minInvestmentScore?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => api.get('/properties', params),

  getById: (id: string) => api.get(`/properties/${id}`),

  getPrediction: (id: string) => api.get(`/properties/${id}/predict`),

  getComps: (id: string, limit?: number) =>
    api.get(`/properties/${id}/comps`, { limit }),

  getInvestmentScore: (id: string) =>
    api.get(`/properties/${id}/investment-score`),
};

// Market API calls
export const marketApi = {
  getHeatmap: (layer?: string, state?: string) =>
    api.get('/market/heatmap', { layer, state }),

  getByZipCode: (zipCode: string) => api.get(`/market/${zipCode}`),

  getTrends: (zipCode: string, months?: number) =>
    api.get(`/market/trends/${zipCode}`, { months }),

  getNeighborhoods: (city: string, state?: string) =>
    api.get(`/market/neighborhoods/${city}`, { state }),

  getOpportunities: (params?: {
    state?: string;
    city?: string;
    minScore?: number;
    limit?: number;
  }) => api.get('/market/opportunities', params),
};

// Analysis API calls
export const analysisApi = {
  calculateCashFlow: (data: {
    purchasePrice: number;
    downPaymentPercent?: number;
    interestRate?: number;
    loanTermYears?: number;
    monthlyRent: number;
    otherIncome?: number;
    vacancyRate?: number;
    propertyTax?: number;
    insurance?: number;
    maintenance?: number;
    hoa?: number;
    propertyManagementPercent?: number;
    utilities?: number;
  }) => api.post('/analysis/cashflow', data),

  calculateInvestmentScore: (data: {
    propertyId?: string;
    listPrice: number;
    predictedPrice?: number;
    appreciationForecast?: number;
    rentalYield?: number;
    daysOnMarket?: number;
    zipCode: string;
  }) => api.post('/analysis/investment-score', data),

  compareProperties: (propertyIds: string[]) =>
    api.post('/analysis/compare', { propertyIds }),
};

// Portfolio API calls
export const portfolioApi = {
  getAll: () => api.get('/portfolio'),

  getById: (id: string) => api.get(`/portfolio/${id}`),

  create: (data: { name: string; description?: string }) =>
    api.post('/portfolio', data),

  addProperty: (
    portfolioId: string,
    data: {
      propertyId: string;
      notes?: string;
      targetPrice?: number;
      alertEnabled?: boolean;
    }
  ) => api.post(`/portfolio/${portfolioId}/items`, data),

  removeProperty: (portfolioId: string, itemId: string) =>
    api.delete(`/portfolio/${portfolioId}/items/${itemId}`),

  getPerformance: (id: string) => api.get(`/portfolio/${id}/performance`),

  getAlerts: (unreadOnly?: boolean) =>
    api.get('/portfolio/alerts', { unread: unreadOnly }),

  markAlertRead: (id: string) => api.patch(`/portfolio/alerts/${id}/read`),
};
