import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Browserbase from '@browserbasehq/sdk';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the Vite build output
app.use(express.static(join(__dirname, '../dist')));

// SPA fallback: serve index.html for all non-file requests (Express 5.x compatible)
app.use((req, res, next) => {
  if (!req.path.includes('.')) {
    res.sendFile(join(__dirname, '../dist/index.html'));
  } else {
    next();
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize BrowserBase (only if API key is configured)
let bb = null;
if (process.env.BROWSERBASE_API_KEY) {
  bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY
  });
  console.log('BrowserBase SDK initialized');
} else {
  console.log('BrowserBase API key not configured - browser preview disabled');
}

let activeSessions = new Map(); // Track active browser sessions

// Socket.IO handlers for browser control
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Start browser session
  socket.on('start-browser', async () => {
    if (!bb) {
      socket.emit('browser-error', { message: 'BrowserBase not configured' });
      return;
    }

    try {
      console.log('Creating BrowserBase session...');

      // Create BrowserBase session
      const session = await bb.sessions.create({
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        browserSettings: {
          viewport: { width: 1280, height: 800 }
        }
      });

      // Get live view URL (debug URL for iframe embedding)
      const debugInfo = await bb.sessions.debug(session.id);

      activeSessions.set(socket.id, session.id);

      socket.emit('browser-ready', {
        sessionId: session.id,
        liveViewUrl: debugInfo.debuggerUrl,
        connectUrl: session.connectUrl
      });

      console.log(`Browser session created: ${session.id}`);
      console.log(`Live view URL: ${debugInfo.debuggerUrl}`);
    } catch (error) {
      console.error('Failed to start browser:', error);
      socket.emit('browser-error', { message: error.message });
    }
  });

  // Navigate to URL (for future use with Playwright integration)
  socket.on('navigate', async (url) => {
    const sessionId = activeSessions.get(socket.id);
    if (!sessionId) {
      console.log('No active session for navigation');
      return;
    }

    try {
      // Navigation will happen via Playwright connection
      // For now, just acknowledge
      socket.emit('navigation-complete');
      console.log(`Navigation requested to: ${url}`);
    } catch (error) {
      console.error('Navigation failed:', error);
    }
  });

  // Stop browser session
  socket.on('stop-browser', async () => {
    const sessionId = activeSessions.get(socket.id);
    if (sessionId && bb) {
      try {
        await bb.sessions.stop(sessionId);
        activeSessions.delete(socket.id);
        console.log(`✓ Browser session stopped: ${sessionId}`);
      } catch (error) {
        console.error('Failed to stop browser:', error);
        // Even if stop fails, remove from our tracking
        activeSessions.delete(socket.id);
      }
    }
  });

  // Client disconnect - CRITICAL for free tier (1 concurrent session limit)
  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    const sessionId = activeSessions.get(socket.id);
    if (sessionId && bb) {
      try {
        // Force stop the session to free up concurrent session slot
        await bb.sessions.stop(sessionId);
        activeSessions.delete(socket.id);
        console.log(`✓ Cleaned up session on disconnect: ${sessionId}`);
      } catch (error) {
        console.error('Failed to cleanup session:', error);
        activeSessions.delete(socket.id);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Manus AI Server running on http://0.0.0.0:${PORT}`);
  console.log(`- Tavily API: ${process.env.VITE_TAVILY_API_KEY ? 'Enabled' : 'Disabled'}`);
  console.log(`- BrowserBase: ${bb ? 'Enabled' : 'Disabled'}`);
});
