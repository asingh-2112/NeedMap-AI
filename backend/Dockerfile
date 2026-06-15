# ── NeedMap AI Backend ──────────────────────────────────────────
FROM python:3.13-slim

WORKDIR /app

# System deps for PyMuPDF (PDF extraction)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Cloud Run sets PORT=8080
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]