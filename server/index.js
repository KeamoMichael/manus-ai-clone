import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Sandbox } from '@e2b/desktop';
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

// Check if E2B API key is configured
const E2B_ENABLED = !!process.env.E2B_API_KEY;

if (E2B_ENABLED) {
  console.log('E2B Desktop Sandbox enabled');
} else {
  console.log('E2B API key not configured - browser preview disabled');
}

let activeSandboxes = new Map(); // Track active desktop sandboxes

// Socket.IO handlers for browser control
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Start desktop sandbox with browser
  socket.on('start-browser', async () => {
    if (!E2B_ENABLED) {
      socket.emit('browser-error', { message: 'E2B not configured. Add E2B_API_KEY to environment.' });
      return;
    }

    try {
      console.log('[E2B] Creating desktop sandbox...');

      // Create E2B desktop sandbox
      const sandbox = await Sandbox.create({
        apiKey: process.env.E2B_API_KEY,
        timeout: 3600000, // 1 hour
      });

      console.log(`[E2B] Sandbox created: ${sandbox.sandboxId}`);

      // Start video stream (correct E2B API)
      await sandbox.stream.start({
        requireAuth: false  // Set to true if you want password protection
      });

      // Get stream URL
      const streamUrl = sandbox.stream.getUrl();

      // Store sandbox and stream
      activeSandboxes.set(socket.id, {
        sandbox,
        sandboxId: sandbox.sandboxId
      });

      socket.emit('browser-ready', {
        sessionId: sandbox.sandboxId,
        liveViewUrl: streamUrl  // This is the iframe URL!
      });

      console.log(`✓ Desktop sandbox ready: ${sandbox.sandboxId}`);
      console.log(`✓ Stream URL: ${streamUrl}`);

      // Optional: Open Chrome automatically with Google homepage
      try {
        await sandbox.commands.run('DISPLAY=:1 google-chrome --no-sandbox --disable-dev-shm-usage https://google.com &');
        console.log('✓ Chrome launched with Google homepage');
      } catch (e) {
        console.log('Note: Chrome launch failed (may not be pre-installed):', e.message);
      }

    } catch (error) {
      console.error('[E2B] Failed to create sandbox:', error);
      socket.emit('browser-error', { message: error.message });
    }
  });

  // Navigate to URL (using Chrome in the sandbox)
  socket.on('navigate', async (url) => {
    const session = activeSandboxes.get(socket.id);
    if (!session) {
      console.log('No active sandbox for navigation');
      return;
    }

    try {
      // Use command execution to open Chrome with the URL
      // First, ensure Chrome is killed if running
      await session.sandbox.commands.run('pkill chrome || true');

      // Wait a moment for Chrome to close
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now open Chrome with the specific URL
      await session.sandbox.commands.run(`DISPLAY=:1 google-chrome --no-sandbox --disable-dev-shm-usage "${url}" &`);

      socket.emit('navigation-complete');
      console.log(`✓ Navigated to: ${url}`);
    } catch (error) {
      console.error('Navigation failed:', error);
      socket.emit('navigation-complete'); // Still emit to prevent hanging
    }
  });

  // Stop sandbox
  socket.on('stop-browser', async () => {
    const session = activeSandboxes.get(socket.id);
    if (session) {
      try {
        await session.sandbox.close();
        activeSandboxes.delete(socket.id);
        console.log(`✓ Sandbox closed: ${session.sandboxId}`);
      } catch (error) {
        console.error('Failed to close sandbox:', error);
        activeSandboxes.delete(socket.id);
      }
    }
  });

  // Client disconnect - CRITICAL cleanup
  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    const session = activeSandboxes.get(socket.id);
    if (session) {
      try {
        // Close sandbox to free up resources
        await session.sandbox.close();
        activeSandboxes.delete(socket.id);
        console.log(`✓ Cleaned up sandbox on disconnect: ${session.sandboxId}`);
      } catch (error) {
        console.error('Failed to cleanup sandbox:', error);
        activeSandboxes.delete(socket.id);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Manus AI Server running on http://0.0.0.0:${PORT}`);
  console.log(`- Tavily API: ${process.env.VITE_TAVILY_API_KEY ? 'Enabled' : 'Disabled'}`);
  console.log(`- E2B Desktop: ${E2B_ENABLED ? 'Enabled (20 concurrent sandboxes!)' : 'Disabled'}`);
});
