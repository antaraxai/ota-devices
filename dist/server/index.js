"use strict";
const express = require('express');
const cors = require('cors');
const { createServer: createViteServer } = require('vite');
const deviceRoutes = require('../api/device');
async function createServer() {
    const app = express();
    const port = process.env.PORT || 5173;
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
