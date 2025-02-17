// Configuration for API endpoints
export const config = {
  apiBaseUrl: 'http://localhost:5001',
  socketUrl: 'http://localhost:5003',
  corsOptions: {
    origin: 'http://localhost:3001',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
};
