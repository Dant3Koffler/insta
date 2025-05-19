import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

import { startInstagram } from './instagram.js';
import { startAmberAgent } from '../agent/amber.js';
import { startTikTok }    from './tiktok.js';
import { createToken } from './pumpfun.js';

dotenv.config();

// if (!process.env.PUMP_PRIVATE_KEY) throw new Error("Missing PUMP_PRIVATE_KEY");
// if (!process.env.SOLANA_RPC_URL)  throw new Error("Missing SOLANA_RPC_URL");

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const TOKEN_HISTORY_FILE = './token-history.json';

// Global tokens storage
let tokenStorage = [];

// Initialize token storage from file or create new file
function initTokenStorage() {
  try {
    console.log(`Initializing token storage from ${TOKEN_HISTORY_FILE}`);
    if (fs.existsSync(TOKEN_HISTORY_FILE)) {
      const data = fs.readFileSync(TOKEN_HISTORY_FILE, 'utf8');
      if (data && data.trim()) {
        tokenStorage = JSON.parse(data);
        console.log(`Loaded ${tokenStorage.length} tokens from storage file`);
      } else {
        console.log('Token storage file exists but is empty, initializing empty array');
        tokenStorage = [];
      }
    } else {
      console.log('Token storage file does not exist, creating new file');
      tokenStorage = [];
      fs.writeFileSync(TOKEN_HISTORY_FILE, JSON.stringify(tokenStorage, null, 2));
    }
  } catch (error) {
    console.error('Error initializing token storage:', error);
    tokenStorage = [];
    try {
      fs.writeFileSync(TOKEN_HISTORY_FILE, JSON.stringify(tokenStorage, null, 2));
    } catch (e) {
      console.error('Failed to create token storage file:', e);
    }
  }
}

// Save tokens to file
function saveTokensToFile() {
  try {
    fs.writeFileSync(TOKEN_HISTORY_FILE, JSON.stringify(tokenStorage, null, 2));
    console.log(`Saved ${tokenStorage.length} tokens to ${TOKEN_HISTORY_FILE}`);
    return true;
  } catch (error) {
    console.error('Error saving tokens to file:', error);
    return false;
  }
}

// Add a token to storage
function addToken(token) {
  if (!token || !token.name) {
    console.error('Cannot add invalid token:', token);
    return false;
  }
  
  // Ensure token has an ID
  if (!token.id) {
    token.id = `token${Date.now()}${Math.floor(Math.random() * 10000)}`;
  }
  
  // Add to storage
  tokenStorage.unshift(token);
  
  // Save changes
  saveTokensToFile();
  
  console.log(`Added token to storage: ${token.name} (${token.symbol || token.ticker})`);
  return true;
}

// Delete a token from storage
function deleteToken(tokenId) {
  if (!tokenId) return false;
  
  const initialLength = tokenStorage.length;
  tokenStorage = tokenStorage.filter(token => token.id !== tokenId);
  
  if (tokenStorage.length === initialLength) {
    console.log(`Token ${tokenId} not found in storage`);
    return false;
  }
  
  // Save changes
  saveTokensToFile();
  
  console.log(`Deleted token ${tokenId} from storage`);
  return true;
}

// Get all tokens
function getAllTokens() {
  return tokenStorage;
}

// Initialize token storage on server start
initTokenStorage();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET","POST"] },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Serve static files from the public directory
app.use(express.static(join(__dirname, 'public')));

// Serve frontend files
app.use('/frontend', express.static(join(__dirname, 'public/frontend')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public/frontend/index.html'));
});

app.get('/favicon.ico', (req, res) => {
  const svgFavicon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="32" height="32">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ff417a;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#ff7642;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#ffcb42;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="80" height="80" x="10" y="10" fill="url(#grad)" />
      <rect width="10" height="10" x="10" y="10" fill="#8a2387" />
      <rect width="10" height="10" x="80" y="10" fill="#8a2387" />
      <rect width="10" height="10" x="10" y="80" fill="#8a2387" />
      <rect width="10" height="10" x="80" y="80" fill="#8a2387" />
      <text x="50" y="65" font-family="Arial" font-size="50" font-weight="bold" text-anchor="middle" fill="white">T</text>
    </svg>
  `;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svgFavicon);
});

const connectedClients = new Set();
io.on('connection', (socket) => {
  connectedClients.add(socket.id);
  console.log(`Client connected: ${socket.id} (Total: ${connectedClients.size})`);
  
  // Send current tokens to newly connected client
  socket.emit('initialTokens', getAllTokens());
  
  socket.emit('serverMessage', {
    message: 'Connected to Meme Token Monitor',
    timestamp: new Date().toISOString()
  });
  
  socket.on('disconnect', reason => {
    connectedClients.delete(socket.id);
    console.log(`Client disconnected: ${socket.id} (Reason: ${reason}) (Total: ${connectedClients.size})`);
  });
  
  socket.on('error', err => {
    console.error(`Socket error for ${socket.id}:`, err);
  });
  
  // Handle new token creation
  socket.on('adminAddToken', (token) => {
    console.log('adminAddToken received:', token);
    
    if (!token) {
      console.error('Received empty token data');
      return;
    }
    
    // Normalize token object
    const normalizedToken = {
      id: token.id || `token${Date.now()}${Math.floor(Math.random() * 10000)}`,
      name: token.name,
      symbol: token.symbol || token.ticker || 'UNKNOWN',
      platform: token.platform || 'instagram',
      timestamp: token.timestamp || new Date().toISOString(),
      postUrl: token.postUrl || token.instagramPost || '#',
      pumpfunUrl: token.pumpfunUrl || token.pumpFunLink || '#',
      image: token.image || token.imageData || null
    };
    
    // Add to storage
    if (addToken(normalizedToken)) {
      // Broadcast to all clients
      io.emit('newToken', normalizedToken);
    }
  });
  
  // Handle token deletion
  socket.on('deleteToken', (data) => {
    console.log('deleteToken received:', data);
    
    if (data && data.tokenId) {
      if (deleteToken(data.tokenId)) {
        // Broadcast deletion to all clients
        io.emit('deleteToken', { tokenId: data.tokenId });
      }
    }
  });
});

// API endpoint to get all tokens
app.get('/api/token-history', (req, res) => {
  console.log('API request for token history');
  res.json(getAllTokens());
});

// API endpoint to test token emission
app.get('/api/test-emit', (req, res) => {
  const token = {
    id: `test${Date.now()}`,
    name: 'Test Token',
    symbol: 'TEST',
    platform: 'instagram',
    timestamp: new Date().toISOString(),
    postUrl: '#',
    pumpfunUrl: '#',
    image: null
  };
  
  // Add to storage
  addToken(token);
  
  // Broadcast to all clients
  io.emit('newToken', token);
  
  res.json({ success: true, token });
});

const PORT = process.env.PORT || 80;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT}`);
});
