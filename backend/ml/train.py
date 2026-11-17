"""
ml/train.py — Train and save the LightGBM Safety Score model.

Usage:
    cd tourist_safety_app
    python -m ml.train
"""
import joblib
try:
    import shap
except ImportError:
    shap = None
from pathlib import Path

from ml.safety_score_model import build_dataset, train

_ML_DIR = Path(__file__).resolve().parent
MODEL_PATH    = _ML_DIR / "safety_model.joblib"
EXPLAINER_PATH = _ML_DIR / "shap_explainer.joblib"


def run_training():
    print("Building synthetic training dataset …")
    df = build_dataset(n_cells=400)
    print(f"Dataset: {len(df)} rows × {df.shape[1]} columns")

    print("Training LightGBM model …")
    model = train(df)

    explainer = None
    if shap is not None:
        try:
            print("Building SHAP TreeExplainer …")
            explainer = shap.TreeExplainer(model)
            joblib.dump(explainer, EXPLAINER_PATH)
            print(f"Saved explainer  -> {EXPLAINER_PATH}")
        except Exception as e:
            print(f"Could not build SHAP explainer: {e}")

    joblib.dump(model, MODEL_PATH)
    print(f"Saved model      -> {MODEL_PATH}")
    return model, explainer


def load_model():
    """Load model and explainer from disk; auto-train if missing or incompatible."""
    model = None
    if MODEL_PATH.exists():
        try:
            model = joblib.load(MODEL_PATH)
        except Exception:
            print("Cached model incompatible with current environment — re-training...")
            model = None

    if model is None:
        model, _ = run_training()

    explainer = None
    if EXPLAINER_PATH.exists():
        try:
            explainer = joblib.load(EXPLAINER_PATH)
        except Exception:
            explainer = None
    return model, explainer


if __name__ == "__main__":
    run_training()
