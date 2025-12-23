# Gunakan image Node.js yang ringan
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy file package.json dan package-lock.json dulu (biar cache jalan)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy seluruh source code frontend
COPY . .

# Expose port default Vite (5173)
EXPOSE 5173

# Jalankan server development dengan opsi --host agar bisa diakses dari luar container
CMD ["npm", "run", "dev", "--", "--host"]