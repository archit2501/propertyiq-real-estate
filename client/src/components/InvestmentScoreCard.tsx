import { TrendingUp, Shield, DollarSign, BarChart3, Droplets } from 'lucide-react';

interface ScoreComponents {
  appreciationPotential: number;
  cashFlowScore: number;
  riskAdjustedReturn: number;
  marketMomentum: number;
  liquidityScore: number;
}

interface InvestmentScoreCardProps {
  overallScore: number;
  components: ScoreComponents;
  riskLevel: string;
  recommendation: string;
}

export default function InvestmentScoreCard({
  overallScore,
  components,
  riskLevel,
  recommendation,
}: InvestmentScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-amber-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-700';
      case 'medium-low':
        return 'bg-green-100 text-green-700';
      case 'medium':
        return 'bg-amber-100 text-amber-700';
      case 'medium-high':
        return 'bg-orange-100 text-orange-700';
      case 'high':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const scoreItems = [
    {
      label: 'Appreciation Potential',
      value: components.appreciationPotential,
      icon: TrendingUp,
      weight: '30%',
    },
    {
      label: 'Cash Flow Score',
      value: components.cashFlowScore,
      icon: DollarSign,
      weight: '25%',
    },
    {
      label: 'Risk-Adjusted Return',
      value: components.riskAdjustedReturn,
      icon: Shield,
      weight: '20%',
    },
    {
      label: 'Market Momentum',
      value: components.marketMomentum,
      icon: BarChart3,
      weight: '15%',
    },
    {
      label: 'Liquidity Score',
      value: components.liquidityScore,
      icon: Droplets,
      weight: '10%',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Overall Score */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Investment Score
          </h3>
          <span className={`text-xs px-2 py-1 rounded-full ${getRiskColor(riskLevel)}`}>
            {riskLevel} Risk
          </span>
        </div>
        <div className="text-center">
          <div
            className={`text-4xl font-bold ${getScoreColor(overallScore)}`}
          >
            {overallScore}
          </div>
          <div className="text-sm text-gray-500">out of 100</div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-4">
        {scoreItems.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center text-sm text-gray-600">
                <item.icon className="w-4 h-4 mr-2" />
                {item.label}
                <span className="text-xs text-gray-400 ml-1">({item.weight})</span>
              </div>
              <span className={`text-sm font-medium ${getScoreColor(item.value)}`}>
                {item.value}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getScoreBgColor(item.value)}`}
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Recommendation
        </h4>
        <p className="text-sm text-gray-600">{recommendation}</p>
      </div>
    </div>
  );
}
