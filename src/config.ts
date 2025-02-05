// Configuration for API endpoints
export const config = {
  apiBaseUrl: 'http://157.245.147.73:5001',
  socketUrl: 'http://157.245.147.73:5001',
  corsOptions: {
    origin: 'http://157.245.147.73:3001',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
};
