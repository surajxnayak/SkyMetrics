FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ api/
COPY db/ db/
COPY index/ index/
COPY models/ models/
COPY pipeline/ pipeline/
COPY scraper/ scraper/
COPY config/ config/

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
