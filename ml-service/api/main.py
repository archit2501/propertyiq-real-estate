from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
import numpy as np
import joblib
import os
from datetime import datetime, timedelta

app = FastAPI(
    title="PropertyIQ ML Service",
    description="Machine learning service for real estate price prediction and analysis",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models (in production, these would be loaded from files)
models = {}

def load_models():
    """Load trained models from disk."""
    model_dir = os.path.join(os.path.dirname(__file__), "..", "models")

    try:
        if os.path.exists(os.path.join(model_dir, "price_predictor.joblib")):
            models["price_predictor"] = joblib.load(
                os.path.join(model_dir, "price_predictor.joblib")
            )
        if os.path.exists(os.path.join(model_dir, "appreciation_model.joblib")):
            models["appreciation_model"] = joblib.load(
                os.path.join(model_dir, "appreciation_model.joblib")
            )
    except Exception as e:
        print(f"Error loading models: {e}")

@app.on_event("startup")
async def startup_event():
    load_models()

# Request/Response models
class PropertyFeatures(BaseModel):
    property_id: str
    sqft: int
    bedrooms: int
    bathrooms: float
    year_built: Optional[int] = None
    lot_size: Optional[int] = None
    property_type: str
    latitude: float
    longitude: float
    zip_code: str

class PredictionResponse(BaseModel):
    property_id: str
    predicted_price: int
    confidence_interval: Dict[str, int]
    appreciation_forecast: float
    feature_importance: Dict[str, float]
    model_version: str

class CompsRequest(BaseModel):
    property_id: str
    latitude: float
    longitude: float
    sqft: int
    bedrooms: int
    bathrooms: float
    property_type: str
    limit: int = 10

class InvestmentScoreRequest(BaseModel):
    property_id: str
    list_price: int
    predicted_price: Optional[int] = None
    sqft: int
    appreciation_forecast: Optional[float] = None
    market_metrics: Optional[Dict[str, Any]] = None

class InvestmentScoreResponse(BaseModel):
    overall_score: int
    appreciation_score: int
    cash_flow_score: int
    risk_adjusted_score: int
    market_momentum_score: int
    liquidity_score: int
    risk_score: int
    risk_level: str
    recommendation: str
    key_factors: List[str]

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "models_loaded": list(models.keys()),
        "timestamp": datetime.utcnow().isoformat()
    }

# Price prediction endpoint
@app.post("/predict", response_model=PredictionResponse)
async def predict_price(features: PropertyFeatures):
    """Predict property price using ML model."""

    # Feature engineering
    current_year = datetime.now().year
    property_age = current_year - (features.year_built or 1990)
    price_per_sqft_estimate = estimate_price_per_sqft(
        features.zip_code,
        features.property_type
    )

    # Prepare features for model
    feature_vector = np.array([
        features.sqft,
        features.bedrooms,
        features.bathrooms,
        property_age,
        features.lot_size or features.sqft * 2,
        encode_property_type(features.property_type),
        features.latitude,
        features.longitude,
    ]).reshape(1, -1)

    # Make prediction (using fallback if model not loaded)
    if "price_predictor" in models:
        predicted_price = int(models["price_predictor"].predict(feature_vector)[0])
    else:
        # Fallback estimation based on price per sqft
        predicted_price = int(features.sqft * price_per_sqft_estimate)

    # Calculate confidence interval (±10%)
    confidence_margin = int(predicted_price * 0.10)

    # Estimate appreciation (simplified)
    appreciation = estimate_appreciation(features.zip_code)

    # Feature importance (simplified example)
    feature_importance = {
        "sqft": 0.35,
        "location": 0.25,
        "bedrooms": 0.15,
        "bathrooms": 0.10,
        "property_age": 0.08,
        "lot_size": 0.07,
    }

    return PredictionResponse(
        property_id=features.property_id,
        predicted_price=predicted_price,
        confidence_interval={
            "low": predicted_price - confidence_margin,
            "high": predicted_price + confidence_margin,
        },
        appreciation_forecast=appreciation,
        feature_importance=feature_importance,
        model_version="1.0.0"
    )

# Comparable properties endpoint
@app.post("/comps")
async def find_comparables(request: CompsRequest):
    """Find comparable properties using similarity scoring."""

    # In production, this would query the database
    # For demo, returning synthetic comps
    comparables = generate_synthetic_comps(request)

    return {
        "property_id": request.property_id,
        "comparables": comparables,
        "methodology": "Distance-weighted similarity scoring"
    }

# Investment score endpoint
@app.post("/investment-score", response_model=InvestmentScoreResponse)
async def calculate_investment_score(request: InvestmentScoreRequest):
    """Calculate investment score based on multiple factors."""

    # Calculate component scores
    appreciation_score = calculate_appreciation_score(
        request.list_price,
        request.predicted_price,
        request.appreciation_forecast
    )

    cash_flow_score = calculate_cash_flow_score(
        request.list_price,
        request.sqft,
        request.market_metrics
    )

    market_momentum_score = calculate_market_momentum_score(
        request.market_metrics
    )

    liquidity_score = calculate_liquidity_score(
        request.market_metrics
    )

    risk_score = calculate_risk_score(
        request.market_metrics
    )

    # Risk-adjusted score
    risk_adjusted_score = int(
        (appreciation_score + cash_flow_score) / 2 * (1 - risk_score / 200)
    )

    # Weighted overall score
    overall_score = int(
        appreciation_score * 0.30 +
        cash_flow_score * 0.25 +
        risk_adjusted_score * 0.20 +
        market_momentum_score * 0.15 +
        liquidity_score * 0.10
    )

    # Determine risk level
    risk_level = get_risk_level(risk_score)

    # Generate recommendation
    recommendation = generate_recommendation(
        overall_score,
        appreciation_score,
        cash_flow_score,
        risk_score
    )

    # Key factors
    key_factors = get_key_factors(
        appreciation_score,
        cash_flow_score,
        market_momentum_score,
        liquidity_score
    )

    return InvestmentScoreResponse(
        overall_score=overall_score,
        appreciation_score=appreciation_score,
        cash_flow_score=cash_flow_score,
        risk_adjusted_score=risk_adjusted_score,
        market_momentum_score=market_momentum_score,
        liquidity_score=liquidity_score,
        risk_score=risk_score,
        risk_level=risk_level,
        recommendation=recommendation,
        key_factors=key_factors
    )

# Helper functions
def estimate_price_per_sqft(zip_code: str, property_type: str) -> float:
    """Estimate price per sqft based on location and property type."""
    base_prices = {
        "SINGLE_FAMILY": 250,
        "CONDO": 300,
        "TOWNHOUSE": 275,
        "MULTI_FAMILY": 200,
    }
    return base_prices.get(property_type, 250)

def encode_property_type(property_type: str) -> int:
    """Encode property type as numeric."""
    encodings = {
        "SINGLE_FAMILY": 1,
        "CONDO": 2,
        "TOWNHOUSE": 3,
        "MULTI_FAMILY": 4,
        "LAND": 5,
        "COMMERCIAL": 6,
    }
    return encodings.get(property_type, 1)

def estimate_appreciation(zip_code: str) -> float:
    """Estimate 12-month appreciation forecast."""
    # In production, this would use historical data and Prophet
    return np.random.uniform(3.0, 8.0)

def generate_synthetic_comps(request: CompsRequest) -> List[Dict]:
    """Generate synthetic comparable properties for demo."""
    comps = []
    for i in range(request.limit):
        variance = np.random.uniform(-0.15, 0.15)
        comp = {
            "address": f"{100 + i * 10} Demo Street",
            "city": "Sample City",
            "state": "CA",
            "sold_price": int(request.sqft * 250 * (1 + variance)),
            "sold_date": (datetime.now() - timedelta(days=np.random.randint(30, 180))).isoformat(),
            "sqft": int(request.sqft * (1 + np.random.uniform(-0.1, 0.1))),
            "bedrooms": request.bedrooms + np.random.choice([-1, 0, 1]),
            "bathrooms": request.bathrooms,
            "distance": round(np.random.uniform(0.1, 2.0), 2),
            "similarity": round(np.random.uniform(0.75, 0.95), 2),
        }
        comps.append(comp)
    return sorted(comps, key=lambda x: x["similarity"], reverse=True)

def calculate_appreciation_score(
    list_price: int,
    predicted_price: Optional[int],
    appreciation_forecast: Optional[float]
) -> int:
    """Calculate appreciation potential score."""
    score = 50

    if predicted_price and list_price:
        upside = ((predicted_price - list_price) / list_price) * 100
        score = min(100, max(0, 50 + upside * 5))

    if appreciation_forecast:
        score = min(100, int((score + appreciation_forecast * 5) / 2))

    return score

def calculate_cash_flow_score(
    list_price: int,
    sqft: int,
    market_metrics: Optional[Dict]
) -> int:
    """Calculate cash flow potential score."""
    # Estimate rental yield
    estimated_rent = sqft * 1.5  # $1.50 per sqft monthly
    annual_rent = estimated_rent * 12
    gross_yield = (annual_rent / list_price) * 100

    return min(100, int(gross_yield * 10))

def calculate_market_momentum_score(market_metrics: Optional[Dict]) -> int:
    """Calculate market momentum score."""
    if not market_metrics:
        return 50

    appreciation = market_metrics.get("appreciation_1y", 0)
    return min(100, max(0, 50 + appreciation * 3))

def calculate_liquidity_score(market_metrics: Optional[Dict]) -> int:
    """Calculate market liquidity score."""
    if not market_metrics:
        return 50

    days_on_market = market_metrics.get("days_on_market_avg", 60)
    return max(0, 100 - days_on_market)

def calculate_risk_score(market_metrics: Optional[Dict]) -> int:
    """Calculate risk score (higher = more risky)."""
    if not market_metrics:
        return 50

    temperature = market_metrics.get("market_temperature", "NEUTRAL")
    scores = {
        "HOT": 30,
        "WARM": 40,
        "NEUTRAL": 50,
        "COOL": 60,
        "COLD": 70,
    }
    return scores.get(temperature, 50)

def get_risk_level(risk_score: int) -> str:
    """Convert risk score to risk level string."""
    if risk_score <= 30:
        return "Low"
    elif risk_score <= 50:
        return "Medium-Low"
    elif risk_score <= 70:
        return "Medium"
    elif risk_score <= 85:
        return "Medium-High"
    return "High"

def generate_recommendation(
    overall: int,
    appreciation: int,
    cash_flow: int,
    risk: int
) -> str:
    """Generate investment recommendation."""
    if overall >= 80:
        return "Strong Buy - Excellent investment opportunity."
    elif overall >= 65:
        return "Buy - Good investment potential."
    elif overall >= 50:
        if appreciation > 70:
            return "Consider - Strong appreciation potential for growth investors."
        if cash_flow > 70:
            return "Consider - Strong cash flow for income investors."
        return "Hold - Average investment opportunity."
    elif risk > 70:
        return "Avoid - High risk with below-average returns."
    return "Pass - Look for better alternatives."

def get_key_factors(
    appreciation: int,
    cash_flow: int,
    momentum: int,
    liquidity: int
) -> List[str]:
    """Get key investment factors."""
    factors = []

    if appreciation >= 70:
        factors.append("Strong appreciation potential")
    elif appreciation <= 30:
        factors.append("Limited appreciation upside")

    if cash_flow >= 70:
        factors.append("Excellent cash flow opportunity")
    elif cash_flow <= 30:
        factors.append("Weak rental yield")

    if momentum >= 70:
        factors.append("Strong market momentum")
    elif momentum <= 30:
        factors.append("Declining market trend")

    if liquidity >= 70:
        factors.append("High market liquidity")
    elif liquidity <= 30:
        factors.append("Low market liquidity - longer hold times expected")

    return factors or ["Average market conditions"]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
