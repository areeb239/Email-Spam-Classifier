"""
FastAPI serving layer for the email/SMS spam classifier.

Assumes a single pickle file containing a full sklearn Pipeline
(TF-IDF vectorizer + classifier combined), e.g. saved with:

    import joblib
    joblib.dump(pipeline, "model.pkl")

Run locally with:
    uvicorn app:app --reload

Then open http://127.0.0.1:8000/docs to test it interactively.
"""

import string
import sys

import joblib
import nltk
import pandas as pd
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from nltk.corpus import stopwords
from nltk.stem.porter import PorterStemmer
from pydantic import BaseModel, Field

MODEL_PATH = "spam_model.pkl"  # matches joblib.dump(grid.best_estimator_, "spam_model.pkl")

# --- make sure required NLTK data is available ---
for resource in ("punkt", "punkt_tab", "stopwords"):
    try:
        nltk.data.find(f"tokenizers/{resource}" if "punkt" in resource else f"corpora/{resource}")
    except LookupError:
        nltk.download(resource)

STOPWORDS = set(stopwords.words("english"))
ps = PorterStemmer()


# --- these MUST match the functions used when the pipeline was trained/pickled,
#     since joblib needs them defined here (by the same name) to unpickle it ---
def transform_text(text: str) -> str:
    text = text.lower()
    tokens = nltk.word_tokenize(text)
    tokens = [t for t in tokens if t.isalnum()]
    tokens = [t for t in tokens if t not in STOPWORDS and t not in string.punctuation]
    tokens = [ps.stem(t) for t in tokens]
    return " ".join(tokens)


def transform_text_series(messages):
    """Wraps transform_text so it works as a column -> column Pipeline step."""
    return messages.apply(transform_text)


def to_dense(X):
    """GaussianNB needs dense input; other classifiers handle sparse directly."""
    return X.toarray()


# --- the pickle file expects these functions on the __main__ module (because
#     the original training script was run directly as `python train.py`).
#     When this app is launched via uvicorn, THIS file is no longer __main__,
#     so we register the functions there manually to make unpickling work
#     regardless of how the app is started. ---
_main_module = sys.modules["__main__"]
_main_module.transform_text = transform_text
_main_module.transform_text_series = transform_text_series
_main_module.to_dense = to_dense


app = FastAPI(
    title="Email/SMS Spam Classifier API",
    description="Predicts whether a given message is spam or ham (not spam).",
    version="1.0.0",
)

# Enable CORS for frontend web requests from any origin/port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount current directory for static files (css, js, images)
_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

# --- load the trained pipeline once, at startup ---
model = joblib.load(MODEL_PATH)


# --- request/response schemas ---
class PredictRequest(BaseModel):
    text: str = Field(..., min_length=1, description="The email/SMS text to classify")


class PredictResponse(BaseModel):
    prediction: str          # "spam" or "ham"
    confidence: float        # probability of the predicted class


@app.get("/")
def root():
    index_path = os.path.join(_CURRENT_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"status": "ok", "message": "Spam classifier API is running"}


@app.get("/style.css")
def serve_css():
    css_path = os.path.join(_CURRENT_DIR, "style.css")
    if os.path.exists(css_path):
        return FileResponse(css_path, media_type="text/css")
    return {"error": "style.css not found"}


@app.get("/script.js")
def serve_js():
    js_path = os.path.join(_CURRENT_DIR, "script.js")
    if os.path.exists(js_path):
        return FileResponse(js_path, media_type="application/javascript")
    return {"error": "script.js not found"}


@app.get("/health")
def health():
    """Simple health check endpoint, useful for Docker/CI/deployment checks."""
    return {"status": "healthy"}


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    text = request.text

    # the pipeline's ColumnTransformer expects a DataFrame with these exact
    # columns: Text, num_chara, num_words, num_sentences (see training script)
    input_df = pd.DataFrame({
        "Text": [text],
        "num_chara": [len(text)],
        "num_words": [len(nltk.word_tokenize(text))],
        "num_sentences": [len(nltk.sent_tokenize(text))],
    })

    prediction = model.predict(input_df)[0]

    # if the model supports predict_proba, use it for a confidence score
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(input_df)[0]
        confidence = float(max(probabilities))
    else:
        confidence = 1.0  # fallback if the model has no probability output

    label = "spam" if str(prediction).lower() in ("1", "spam") else "ham"

    return PredictResponse(prediction=label, confidence=confidence)


if __name__ == "__main__":
    import uvicorn
    print("Starting Spam Classifier API on http://127.0.0.1:8000 ...")
    uvicorn.run(app, host="127.0.0.1", port=8000)