# Gunakan image Python resmi sebagai base
FROM python:3.10-slim

# Set working directory di dalam container
WORKDIR /app

# Install dependencies sistem yang mungkin dibutuhkan (opsional tapi disarankan untuk psycopg2/weasyprint)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Salin file requirements terlebih dahulu untuk memanfaatkan cache layer Docker
COPY requirements.txt .

# Install dependencies Python
RUN pip install --no-cache-dir -r requirements.txt

# Salin seluruh sisa source code ke dalam container
COPY . .

# Expose port yang digunakan Flask
EXPOSE 5000

# Perintah untuk menjalankan aplikasi
CMD ["python", "app.py"]