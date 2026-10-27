FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci
COPY frontend ./frontend
WORKDIR /app/frontend
EXPOSE 3000
CMD ["npm", "run", "dev"]
