import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import deviceRoutes from '../api/device.js';
const app = express();
const port = process.env.PORT || 5173;
async function createServer() {
    // Create Vite server in middleware mode
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
    });
    // Use vite's connect instance as middleware
    app.use(vite.middlewares);
    // Middleware
    app.use(cors());
    app.use(express.json());
    // API Routes
    app.use('/api', deviceRoutes);
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}
createServer();
