FROM node:20-alpine
WORKDIR /app
COPY package.json serve.mjs ./
COPY lib ./lib
COPY templates ./templates
COPY public ./public
ENV NODE_ENV=production PORT=3100 HOST=0.0.0.0
EXPOSE 3100
USER node
CMD ["node", "serve.mjs"]
