import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import puppeteer from 'puppeteer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());

// Serve static files from the Vite build output
app.use(express.static(join(__dirname, '../dist')));

// SPA fallback: serve index.html for all non-file requests (Express 5.x compatible)
app.use((req, res, next) => {
  // If the request is not for a file (no extension), serve index.html
  if (!req.path.includes('.')) {
    res.sendFile(join(__dirname, '../dist/index.html'));
  } else {
    next();
  }
});


const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow connections from Vite frontend
    methods: ["GET", "POST"]
  }
});

let browser = null;
let page = null;
let screenshotInterval = null;

// Helper to stop streaming
const stopStreaming = () => {
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
    screenshotInterval = null;
  }
};

// Helper to start streaming
const startStreaming = () => {
  stopStreaming();
  screenshotInterval = setInterval(async () => {
    if (!page) return;
    try {
      // Capture screenshot as base64
      const b64 = await page.screenshot({
        encoding: 'base64',
        type: 'jpeg',
        quality: 50 // Lower quality for speed
      });
      io.emit('browser-frame', `data:image/jpeg;base64,${b64}`);
    } catch (e) {
      console.error('Screenshot failed:', e.message);
      stopStreaming();
    }
  }, 200); // 5 FPS
};

io.on('connection', (socket) => {
  console.log('Client connected to Browser Server');

  socket.on('start-browser', async () => {
    if (!browser) {
      console.log('Launching browser...');
      try {
        // Attempt to launch bundled Chromium with crash-prevention flags
        browser = await puppeteer.launch({
          headless: true,
          // executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Commented out to use bundled
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-audio-output',
            '--window-size=1280,800'
          ],
          dumpio: true,
          timeout: 60000
        });
      } catch (e) {
        console.error('Failed to launch browser:', e);
        return;
      }

      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
    }
    // Start streaming to everyone when a new client joins or asks
    startStreaming();
  });

  socket.on('navigate', async (url) => {
    if (!page) return;
    console.log(`Navigating to: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      socket.emit('navigation-complete'); // Notify client that page is ready
      // Start streaming updates
      startStreaming();
    } catch (e) {
      console.error('Navigation failed', e);
    }
  });

  socket.on('get-content', async () => {
    if (!page) {
      socket.emit('page-content', '');
      return;
    }
    try {
      const content = await page.evaluate(() => document.body.innerText);
      // Limit content size to avoid token limits in LLM
      socket.emit('page-content', content.substring(0, 10000));
    } catch (e) {
      console.error('Failed to get content', e);
      socket.emit('page-content', '');
    }
  });

  socket.on('scroll-down', async () => {
    if (page) {
      await page.evaluate(() => {
        window.scrollBy({ top: 300, behavior: 'smooth' });
      });
    }
  });

  socket.on('stop-browser', async () => {
    stopStreaming();
    if (browser) {
      await browser.close();
      browser = null;
      page = null;
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    stopStreaming();
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Browser Server running on http://0.0.0.0:${PORT}`);
});
