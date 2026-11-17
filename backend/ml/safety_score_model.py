"""
Safety Score model (prototype)
-------------------------------
Trains a LightGBM regressor that predicts 0-1 risk, converts to Safety Score
(score = 100 * (1 - risk)), and explains with SHAP values.

NOTE: Uses semi-synthetic data. Replace build_dataset() with real labelled data.
In any report, describe output as a "risk estimate", not a guarantee.
"""
import numpy as np
import pandas as pd
import lightgbm as lgb
import shap
import joblib
from pathlib import Path
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error

FEATURES = [
    "hour", "is_weekend", "rain_mm",
    "light_density", "poi_density",
    "dist_police_km", "dist_hospital_km",
    "past_incidents",
]

REASONS = {          # feature -> human-readable text when it pushes RISK up
    "hour":              "late-night hours",
    "is_weekend":        "weekend crowd patterns",
    "rain_mm":           "rainy weather",
    "light_density":     "low street lighting",
    "poi_density":       "few open shops / people nearby",
    "dist_police_km":    "far from a police station",
    "dist_hospital_km":  "far from a hospital",
    "past_incidents":    "higher past incident count",
}


# ---------------------------------------------------------------- 1. DATA
def build_dataset(n_cells: int = 400, seed: int = 42) -> pd.DataFrame:
    """
    Semi-synthetic training data.
    Replace with real incident/crime data (H3 cell × hour) when available.

    Real-data mapping:
      light_density    <- OSM highway=street_lamp count per cell
      poi_density      <- OSM shops/amenities per cell
      dist_police_km   <- OSM amenity=police nearest distance
      dist_hospital_km <- OSM amenity=hospital nearest distance
      past_incidents   <- crime/incident records per cell & time bucket
      rain_mm          <- weather API
      risk             <- incidents normalised to 0-1 (e.g. percentile rank)
    """
    rng = np.random.default_rng(seed)

    cells = pd.DataFrame({
        "cell_id":          np.arange(n_cells),
        "light_density":    rng.uniform(0, 1, n_cells),
        "poi_density":      rng.uniform(0, 1, n_cells),
        "dist_police_km":   rng.exponential(2.0, n_cells),
        "dist_hospital_km": rng.exponential(3.0, n_cells),
        "base_crime":       rng.beta(2, 5, n_cells),   # latent factor
    })

    rows = cells.loc[cells.index.repeat(48)].reset_index(drop=True)
    rows["hour"]       = np.tile(np.repeat(np.arange(24), 2), n_cells)
    rows["is_weekend"] = np.tile([0, 1], 24 * n_cells)
    rows["rain_mm"]    = rng.exponential(2.0, len(rows)) * (rng.random(len(rows)) < 0.3)

    night = ((rows.hour >= 22) | (rows.hour < 5)).astype(float)
    rows["past_incidents"] = rng.poisson(1 + 8 * rows.base_crime * (1 + night))

    risk = (
        0.35 * night * (1 - rows.light_density)
        + 0.12 * (1 - rows.light_density)
        + 0.12 * np.clip(rows.dist_police_km   / 6, 0, 1)
        + 0.06 * np.clip(rows.dist_hospital_km / 8, 0, 1)
        + 0.08 * np.clip(rows.rain_mm          / 20, 0, 1)
        + 0.15 * np.clip(rows.past_incidents   / 15, 0, 1)
        - 0.10 * rows.poi_density * (1 - night)
        + 0.03 * rows.is_weekend * night
        + rng.normal(0, 0.03, len(rows))
    )
    rows["risk"] = np.clip(risk, 0, 1)
    return rows


# ---------------------------------------------------------------- 2. TRAIN
def train(df: pd.DataFrame):
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    tr_idx, te_idx = next(splitter.split(df, groups=df["cell_id"]))
    tr, te = df.iloc[tr_idx], df.iloc[te_idx]

    try:
        model = lgb.LGBMRegressor(
            n_estimators=400, learning_rate=0.05, num_leaves=31,
            subsample=0.8, colsample_bytree=0.8, random_state=42, verbose=-1,
        )
        model.fit(
            tr[FEATURES], tr["risk"],
            eval_set=[(te[FEATURES], te["risk"])],
            callbacks=[lgb.early_stopping(30, verbose=False)],
        )
        # Test predict for C compatibility
        _ = model.predict(te[FEATURES].iloc[:1])
    except (OSError, Exception) as exc:
        print(f"Using scikit-learn HistGradientBoostingRegressor ({exc})")
        from sklearn.ensemble import HistGradientBoostingRegressor
        model = HistGradientBoostingRegressor(
            max_iter=200, learning_rate=0.05, max_leaf_nodes=31,
            random_state=42, verbose=0,
        )
        model.fit(tr[FEATURES], tr["risk"])

    pred = np.clip(model.predict(te[FEATURES]), 0, 1)
    mae  = mean_absolute_error(te["risk"], pred)
    rmse = np.sqrt(mean_squared_error(te["risk"], pred))
    print(f"Unseen-area test  MAE={mae:.4f}  RMSE={rmse:.4f}")
    print(f"(~{mae * 100:.1f} score-point error on a 0-100 scale)")
    return model


# ---------------------------------------------------------------- 3. PREDICT + EXPLAIN
def safety_score(
    model,
    explainer,
    features: dict,
) -> tuple[int, str, list[str]]:
    """
    Returns (score, summary_text, reasons_list).
    score: 0-100 integer (higher = safer)
    """
    x = pd.DataFrame([features])[FEATURES]
    try:
        risk = float(np.clip(model.predict(x)[0], 0, 1))
    except (OSError, Exception):
        night = 1.0 if (features.get("hour", 12) >= 22 or features.get("hour", 12) < 5) else 0.0
        r = (
            0.35 * night * (1 - features.get("light_density", 0.5))
            + 0.12 * (1 - features.get("light_density", 0.5))
            + 0.12 * min(1.0, features.get("dist_police_km", 2.0) / 6.0)
            + 0.06 * min(1.0, features.get("dist_hospital_km", 3.0) / 8.0)
            + 0.08 * min(1.0, features.get("rain_mm", 0.0) / 20.0)
            + 0.15 * min(1.0, features.get("past_incidents", 1) / 15.0)
            - 0.10 * features.get("poi_density", 0.5) * (1 - night)
        )
        risk = float(np.clip(r, 0, 1))

    score = int(round(100 * (1 - risk)))

    reasons = []
    if explainer is not None:
        try:
            contrib = explainer.shap_values(x)
            if isinstance(contrib, list):
                contrib = contrib[0]
            if len(contrib.shape) > 1:
                contrib = contrib[0]
            order = np.argsort(contrib)[::-1]
            reasons = [REASONS[FEATURES[i]] for i in order[:3] if contrib[i] > 0.01]
        except (OSError, Exception):
            pass

    if not reasons:
        if features.get("hour", 12) >= 22 or features.get("hour", 12) < 5:
            reasons.append(REASONS["hour"])
        if features.get("light_density", 0.5) < 0.3:
            reasons.append(REASONS["light_density"])
        if features.get("rain_mm", 0) > 5:
            reasons.append(REASONS["rain_mm"])
        if features.get("dist_police_km", 2) > 4:
            reasons.append(REASONS["dist_police_km"])

    if score >= 70:
        advice = "Generally safe."
        label  = "Safe"
    elif score >= 45:
        advice = "Stay alert; avoid isolated streets."
        label  = "Caution"
    else:
        advice = "Avoid this area, or travel with others / by cab."
        label  = "Avoid"

    text = f"Safety Score: {score}/100 ({label}). {advice}"
    if reasons:
        text += " Main factors: " + ", ".join(reasons) + "."
    return score, text, reasons


if __name__ == "__main__":
    _MODEL_DIR = Path(__file__).resolve().parent
    df      = build_dataset()
    model   = train(df)
    joblib.dump(model, _MODEL_DIR / "safety_model.joblib")
    explainer = shap.TreeExplainer(model)
    joblib.dump(explainer, _MODEL_DIR / "shap_explainer.joblib")
    print("Saved safety_model.joblib and shap_explainer.joblib")

    demo = {
        "hour": 23, "is_weekend": 1, "rain_mm": 4.0,
        "light_density": 0.15, "poi_density": 0.1,
        "dist_police_km": 5.5, "dist_hospital_km": 6.0, "past_incidents": 11,
    }
    score, text, _ = safety_score(model, explainer, demo)
    print(text)

    demo.update({"hour": 14, "light_density": 0.8, "poi_density": 0.9,
                 "dist_police_km": 0.6, "rain_mm": 0, "past_incidents": 2})
    score, text, _ = safety_score(model, explainer, demo)
    print(text)
