# =============================================
# OfferU - Backend Dockerfile
# =============================================

FROM python:3.12-slim

WORKDIR /app

# WeasyPrint/PyMuPDF runtime dependencies
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		libcairo2 \
		libpango-1.0-0 \
		libpangocairo-1.0-0 \
		libgdk-pixbuf-2.0-0 \
		libglib2.0-0 \
		libharfbuzz0b \
		libfribidi0 \
		libffi8 \
		shared-mime-info \
		fonts-noto-cjk \
	&& rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
