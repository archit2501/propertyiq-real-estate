"""
PropertyIQ Price Prediction Model

Uses XGBoost and LightGBM ensemble for property price prediction.
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
import lightgbm as lgb
import joblib
from typing import Tuple, Dict, List, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PropertyPricePredictor:
    """
    Ensemble model for property price prediction using XGBoost and LightGBM.
    """

    def __init__(self):
        self.xgb_model = None
        self.lgb_model = None
        self.preprocessor = None
        self.feature_names = None
        self.is_fitted = False

        # Feature definitions
        self.numeric_features = [
            'sqft', 'bedrooms', 'bathrooms', 'lot_size',
            'year_built', 'stories', 'garage', 'property_age',
            'latitude', 'longitude'
        ]

        self.categorical_features = [
            'property_type', 'city', 'state'
        ]

    def _create_preprocessor(self) -> ColumnTransformer:
        """Create feature preprocessing pipeline."""
        return ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), self.numeric_features),
                ('cat', OneHotEncoder(handle_unknown='ignore'), self.categorical_features)
            ]
        )

    def _engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create derived features."""
        df = df.copy()

        # Property age
        current_year = pd.Timestamp.now().year
        df['property_age'] = current_year - df['year_built'].fillna(1990)

        # Fill missing values
        df['lot_size'] = df['lot_size'].fillna(df['sqft'] * 2)
        df['stories'] = df['stories'].fillna(1)
        df['garage'] = df['garage'].fillna(0)

        return df

    def fit(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        test_size: float = 0.2,
        random_state: int = 42
    ) -> Dict[str, float]:
        """
        Train the ensemble model.

        Args:
            X: Feature DataFrame
            y: Target prices
            test_size: Proportion of data for testing
            random_state: Random seed

        Returns:
            Dictionary of evaluation metrics
        """
        logger.info("Starting model training...")

        # Engineer features
        X = self._engineer_features(X)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )

        # Create preprocessor
        self.preprocessor = self._create_preprocessor()
        X_train_processed = self.preprocessor.fit_transform(X_train)
        X_test_processed = self.preprocessor.transform(X_test)

        # Store feature names
        self.feature_names = (
            self.numeric_features +
            list(self.preprocessor.named_transformers_['cat'].get_feature_names_out())
        )

        # Train XGBoost
        logger.info("Training XGBoost model...")
        self.xgb_model = xgb.XGBRegressor(
            n_estimators=500,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=random_state,
            n_jobs=-1
        )
        self.xgb_model.fit(
            X_train_processed, y_train,
            eval_set=[(X_test_processed, y_test)],
            verbose=False
        )

        # Train LightGBM
        logger.info("Training LightGBM model...")
        self.lgb_model = lgb.LGBMRegressor(
            n_estimators=500,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=random_state,
            n_jobs=-1,
            verbose=-1
        )
        self.lgb_model.fit(
            X_train_processed, y_train,
            eval_set=[(X_test_processed, y_test)]
        )

        # Evaluate ensemble
        xgb_pred = self.xgb_model.predict(X_test_processed)
        lgb_pred = self.lgb_model.predict(X_test_processed)
        ensemble_pred = (xgb_pred + lgb_pred) / 2

        metrics = {
            'mae': mean_absolute_error(y_test, ensemble_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, ensemble_pred)),
            'r2': r2_score(y_test, ensemble_pred),
            'mape': np.mean(np.abs((y_test - ensemble_pred) / y_test)) * 100
        }

        logger.info(f"Training complete. R² = {metrics['r2']:.4f}, MAPE = {metrics['mape']:.2f}%")

        self.is_fitted = True
        return metrics

    def predict(
        self,
        X: pd.DataFrame,
        return_confidence: bool = True
    ) -> Tuple[np.ndarray, Optional[np.ndarray], Optional[np.ndarray]]:
        """
        Make predictions with optional confidence intervals.

        Args:
            X: Feature DataFrame
            return_confidence: Whether to return confidence intervals

        Returns:
            Tuple of (predictions, lower_bound, upper_bound)
        """
        if not self.is_fitted:
            raise ValueError("Model must be fitted before prediction")

        X = self._engineer_features(X)
        X_processed = self.preprocessor.transform(X)

        # Ensemble prediction
        xgb_pred = self.xgb_model.predict(X_processed)
        lgb_pred = self.lgb_model.predict(X_processed)
        predictions = (xgb_pred + lgb_pred) / 2

        if return_confidence:
            # Use model disagreement for confidence interval
            disagreement = np.abs(xgb_pred - lgb_pred)
            uncertainty = np.maximum(disagreement, predictions * 0.05)  # At least 5%

            lower_bound = predictions - uncertainty * 1.5
            upper_bound = predictions + uncertainty * 1.5

            return predictions, lower_bound, upper_bound

        return predictions, None, None

    def get_feature_importance(self) -> pd.DataFrame:
        """Get feature importance from both models."""
        if not self.is_fitted:
            raise ValueError("Model must be fitted first")

        xgb_importance = self.xgb_model.feature_importances_
        lgb_importance = self.lgb_model.feature_importances_

        # Average importance
        avg_importance = (xgb_importance + lgb_importance) / 2

        importance_df = pd.DataFrame({
            'feature': self.feature_names,
            'xgb_importance': xgb_importance,
            'lgb_importance': lgb_importance,
            'avg_importance': avg_importance
        })

        return importance_df.sort_values('avg_importance', ascending=False)

    def save(self, path: str):
        """Save model to disk."""
        joblib.dump({
            'xgb_model': self.xgb_model,
            'lgb_model': self.lgb_model,
            'preprocessor': self.preprocessor,
            'feature_names': self.feature_names,
        }, path)
        logger.info(f"Model saved to {path}")

    @classmethod
    def load(cls, path: str) -> 'PropertyPricePredictor':
        """Load model from disk."""
        data = joblib.load(path)

        predictor = cls()
        predictor.xgb_model = data['xgb_model']
        predictor.lgb_model = data['lgb_model']
        predictor.preprocessor = data['preprocessor']
        predictor.feature_names = data['feature_names']
        predictor.is_fitted = True

        logger.info(f"Model loaded from {path}")
        return predictor


class AppreciationPredictor:
    """
    Time series model for predicting property appreciation.
    Uses LightGBM with market indicators.
    """

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.is_fitted = False

    def fit(
        self,
        market_data: pd.DataFrame,
        appreciation: pd.Series
    ) -> Dict[str, float]:
        """
        Train appreciation prediction model.

        Args:
            market_data: Market indicators DataFrame
            appreciation: Historical appreciation rates

        Returns:
            Evaluation metrics
        """
        logger.info("Training appreciation model...")

        # Scale features
        X_scaled = self.scaler.fit_transform(market_data)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, appreciation, test_size=0.2, random_state=42
        )

        # Train model
        self.model = lgb.LGBMRegressor(
            n_estimators=300,
            max_depth=4,
            learning_rate=0.03,
            random_state=42,
            verbose=-1
        )
        self.model.fit(X_train, y_train)

        # Evaluate
        predictions = self.model.predict(X_test)
        metrics = {
            'mae': mean_absolute_error(y_test, predictions),
            'rmse': np.sqrt(mean_squared_error(y_test, predictions)),
            'r2': r2_score(y_test, predictions)
        }

        logger.info(f"Appreciation model trained. R² = {metrics['r2']:.4f}")

        self.is_fitted = True
        return metrics

    def predict(self, market_data: pd.DataFrame) -> np.ndarray:
        """Predict appreciation rates."""
        if not self.is_fitted:
            raise ValueError("Model must be fitted first")

        X_scaled = self.scaler.transform(market_data)
        return self.model.predict(X_scaled)

    def save(self, path: str):
        """Save model to disk."""
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler
        }, path)

    @classmethod
    def load(cls, path: str) -> 'AppreciationPredictor':
        """Load model from disk."""
        data = joblib.load(path)

        predictor = cls()
        predictor.model = data['model']
        predictor.scaler = data['scaler']
        predictor.is_fitted = True

        return predictor
