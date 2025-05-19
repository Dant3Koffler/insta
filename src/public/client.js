// Version 2.6 - Added admin console integration with token deletion and timestamp fixes
console.log('Insta Meme client.js version 2.6 loaded');

// Add custom styles for token cards
(function() {
    const customStyles = document.createElement('style');
    customStyles.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap');

        .token-card {
            width: 250px;
            background-color: #262626;
            border: 4px solid #000 !important;
            border-radius: 0 !important;
            box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.5) !important;
            overflow: hidden;
            image-rendering: pixelated !important;
            font-family: 'Press Start 2P', monospace !important;
            margin-bottom: 20px;
        }

        /* Specific platform token styling */
        .instagram-token {
            background-color: #262626;
            border: 4px solid #000 !important;
        }

        .twitter-token {
            background-color: #15202b;
            border: 4px solid #000 !important;
        }

        .tiktok-token {
            background-color: #121212;
            border: 4px solid #000 !important;
        }

        .platform-label {
            background-color: transparent;
            padding: 10px;
            font-size: 10px;
            font-family: 'Press Start 2P', monospace;
            text-align: center;
            text-transform: uppercase;
        }

        .token-name {
            color: white;
            font-size: 16px;
            text-align: center;
            padding: 10px;
            font-family: 'Press Start 2P', monospace;
            text-transform: uppercase;
        }

        .token-symbol-container {
            display: flex;
            justify-content: center;
            margin-bottom: 10px;
        }

        .token-symbol {
            font-size: 14px;
            text-align: center;
            padding: 8px 16px;
            background-color: #121212;
            border-radius: 0;
            font-family: 'Press Start 2P', monospace;
            text-transform: uppercase;
            display: inline-block;
            border: 2px solid #000;
        }

        .token-image {
            height: 140px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #262626;
            border-top: 4px solid #000;
            border-bottom: 4px solid #000;
        }

        .token-image img {
            max-width: 80%;
            max-height: 80px;
            object-fit: contain;
            image-rendering: pixelated;
        }

        .token-links {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            margin-bottom: 10px;
        }

        .token-link {
            color: white;
            padding: 8px 12px;
            font-size: 10px;
            font-family: 'Press Start 2P', monospace;
            text-transform: uppercase;
            border: 0;
            text-decoration: none;
            border: 2px solid #000;
            cursor: pointer;
        }

        .view-post-link {
            background-color: #121212;
        }

        .timestamp {
            font-size: 9px;
            text-align: center;
            padding: 8px;
            font-family: 'Press Start 2P', monospace;
            text-transform: uppercase;
        }

        /* Card header styles */
        .card-header {
            padding: 10px;
            text-align: center;
        }
        
        /* Pagination controls */
        .pagination-controls {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin: 30px auto;
            font-family: 'Press Start 2P', monospace;
        }
        
        .pagination-btn {
            background-color: #121212;
            color: white;
            border: 4px solid #000;
            padding: 10px 20px;
            font-size: 12px;
            cursor: pointer;
            text-transform: uppercase;
            box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.5);
            transition: all 0.1s ease;
        }
        
        .pagination-btn:hover {
            transform: translate(2px, 2px);
            box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);
        }
        
        .pagination-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.5);
        }
        
        .page-info {
            font-family: 'Press Start 2P', monospace;
            font-size: 12px;
            color: white;
            text-shadow: 2px 2px 0 black;
            display: flex;
            align-items: center;
        }
    `;
    document.head.appendChild(customStyles);
})();

document.addEventListener('DOMContentLoaded', () => {
    // Get elements from DOM
    const tokenFeed = document.getElementById('tokenFeed');
    const pageTitle = document.querySelector('.eight-bit-title');
    
    // Platform selection buttons
    const instagramButton = document.getElementById('instagramButton');
    const twitterButton = document.getElementById('twitterButton');
    const tiktokButton = document.getElementById('tiktokButton');
    
    // Platform configurations
    const platforms = {
        instagram: {
            name: 'INSTA MEME',
            label: 'INSTAGRAM',
            bgGradient: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            cardBg: '#262626',
            cardBorder: '#e1306c',
            textColor: '#ffffff',
            accentColor: '#e1306c',
            secondaryBg: '#121212',
            positiveColor: '#4db5f9',
            negativeColor: '#ed4956',
            actionColor: '#e1306c'
        },
        twitter: {
            name: 'INSTA MEME',
            label: 'X',
            bgGradient: 'linear-gradient(135deg, #000000, #14171A, #657786)',
            cardBg: '#15202b',
            cardBorder: '#1DA1F2',
            textColor: '#ffffff',
            accentColor: '#1DA1F2',
            secondaryBg: '#192734',
            positiveColor: '#4BB543',
            negativeColor: '#f44336',
            actionColor: '#1DA1F2'
        },
        tiktok: {
            name: 'INSTA MEME',
            label: 'TIKTOK',
            bgGradient: 'linear-gradient(135deg, #25F4EE, #FE2C55, #000000)',
            cardBg: '#121212',
            cardBorder: '#25F4EE',
            textColor: '#ffffff',
            accentColor: '#25F4EE',
            secondaryBg: '#2A2A2A',
            positiveColor: '#25F4EE',
            negativeColor: '#FE2C55',
            actionColor: '#FE2C55'
        }
    };
    
    // Current platform
    let currentPlatform = 'instagram';
    
    // Pagination variables
    let allTokens = []; // Store all tokens
    let currentPage = 1;
    const tokensPerPage = 12;
    
    // Create pagination controls
    const paginationControls = document.createElement('div');
    paginationControls.className = 'pagination-controls';
    
    // Create prev button
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-btn prev-btn';
    prevButton.textContent = '< PREV';
    prevButton.disabled = true;
    
    // Create page info
    const pageInfo = document.createElement('div');
    pageInfo.className = 'page-info';
    pageInfo.textContent = 'PAGE 1';
    
    // Create next button
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-btn next-btn';
    nextButton.textContent = 'NEXT >';
    nextButton.disabled = true;
    
    // Add button event listeners
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayTokensForCurrentPage();
            updatePaginationControls();
            playBeepSound();
        }
    });
    
    nextButton.addEventListener('click', () => {
        if (currentPage < Math.ceil(allTokens.length / tokensPerPage)) {
            currentPage++;
            displayTokensForCurrentPage();
            updatePaginationControls();
            playBeepSound();
        }
    });
    
    // Add controls to pagination container
    paginationControls.appendChild(prevButton);
    paginationControls.appendChild(pageInfo);
    paginationControls.appendChild(nextButton);
    
    // Initialize UI with default platform
    updatePlatformUI('instagram');
    
    // Platform button handlers - now they just change the UI style but don't generate tokens
    if (instagramButton) {
    instagramButton.addEventListener('click', () => {
        updatePlatformUI('instagram');
        playBeepSound();
    });
    }
    
    if (twitterButton) {
    twitterButton.addEventListener('click', () => {
        updatePlatformUI('twitter');
        playBeepSound();
    });
    }
    
    if (tiktokButton) {
    tiktokButton.addEventListener('click', () => {
        updatePlatformUI('tiktok');
        playBeepSound();
    });
    }
    
    // Function to update UI based on platform
    function updatePlatformUI(platform) {
        currentPlatform = platform;
        const config = platforms[platform];
        
        // Update background
        document.body.style.background = config.bgGradient;
        document.body.style.backgroundAttachment = 'fixed';
        
        // Show token grid if it was hidden
        if (tokenFeed.style.display === 'none' || !tokenFeed.style.display) {
            setupTokenGrid();
        }
        
        console.log(`Switched to ${platform} platform`);
    }
    
    // Setup token grid
    function setupTokenGrid() {
        // Clear token feed
        tokenFeed.innerHTML = '';
        
        // Set token feed styles
        tokenFeed.style.display = 'flex';
        tokenFeed.style.flexWrap = 'wrap';
        tokenFeed.style.justifyContent = 'center';
        tokenFeed.style.gap = '20px';
        tokenFeed.style.maxWidth = '1200px';
        tokenFeed.style.margin = '30px auto';
        tokenFeed.style.padding = '0 20px';
        
        // Add pagination controls after token feed
        const container = tokenFeed.parentElement;
        if (container && !container.querySelector('.pagination-controls')) {
            container.insertBefore(paginationControls, tokenFeed.nextSibling);
        }
        
        // Display tokens for current page
        displayTokensForCurrentPage();
    }
    
    // Function to play beep sound
    function playBeepSound() {
        const audio = new Audio('/sounds/beep.mp3');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Audio play failed:', e));
    }
    
    // Function to play deploy sound
    function playDeploySound() {
        const audio = new Audio('/sounds/deploy.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Audio play failed:', e));
    }
    
    // Function to add a new token
    function addToken(token) {
        // Ensure token has an ID
        if (!token.id) {
            token.id = `token${Date.now()}${Math.floor(Math.random() * 10000)}`;
        }
        
        // Check if token already exists (by ID)
        const existingIndex = allTokens.findIndex(t => t.id === token.id);
        if (existingIndex !== -1) {
            console.log(`Token ${token.id} already exists, updating`);
            allTokens[existingIndex] = token;
        } else {
            // Add to beginning of tokens array
            allTokens.unshift(token);
            
            // Play deploy sound for new tokens
            playDeploySound();
        }
        
        // Reset to first page when new token arrives
        currentPage = 1;
        
        // Update display
        displayTokensForCurrentPage();
        updatePaginationControls();
        
        console.log(`Token processed: ${token.name} (${token.symbol || token.ticker}) from ${token.platform}`);
        
        // If this is a token we're creating (not receiving), send to server
        if (token.isLocal) {
            delete token.isLocal; // Remove the local flag
            
            // Emit the token to the server to broadcast to all clients and save to history
            if (socket && socket.connected) {
                socket.emit('adminAddToken', token);
                console.log('Broadcasting token to all users and saving to server');
            } else {
                console.warn('Socket not connected, unable to broadcast token');
            }
        }
        
        return token.id;
    }
    
    // Function to display tokens for current page
    function displayTokensForCurrentPage() {
        // Clear token feed
        tokenFeed.innerHTML = '';
        
        // Calculate start and end indices
        const startIndex = (currentPage - 1) * tokensPerPage;
        const endIndex = Math.min(startIndex + tokensPerPage, allTokens.length);
        
        // Display tokens for current page
        for (let i = startIndex; i < endIndex; i++) {
            const tokenCard = createTokenCard(allTokens[i]);
            tokenFeed.appendChild(tokenCard);
        }
    }
    
    // Function to update pagination controls
    function updatePaginationControls() {
        const totalPages = Math.ceil(allTokens.length / tokensPerPage);
        
        // Update page info
        pageInfo.textContent = `PAGE ${currentPage}/${totalPages || 1}`;
        
        // Update button states
        prevButton.disabled = currentPage <= 1;
        nextButton.disabled = currentPage >= totalPages || totalPages === 0;
    }
    
    // Function to create a token card
    function createTokenCard(token) {
        const card = document.createElement('div');
        card.className = 'token-card';
        card.classList.add(`${token.platform}-token`);
        card.setAttribute('data-token-id', token.id);
        card.setAttribute('data-timestamp', token.timestamp);
        
        // Get platform config
        const config = platforms[token.platform] || platforms.instagram;
        
        // Platform label
        const platformLabel = document.createElement('div');
        platformLabel.className = 'platform-label';
        platformLabel.textContent = config.label;
        platformLabel.style.color = config.accentColor;
        
        // Token name
        const tokenName = document.createElement('div');
        tokenName.className = 'token-name';
        tokenName.textContent = token.name;
        
        // Token symbol container
        const symbolContainer = document.createElement('div');
        symbolContainer.className = 'token-symbol-container';
        
        // Token symbol
        const tokenSymbol = document.createElement('div');
        tokenSymbol.className = 'token-symbol';
        tokenSymbol.textContent = token.symbol;
        tokenSymbol.style.color = config.accentColor;
        
        symbolContainer.appendChild(tokenSymbol);
        
        // Card header section
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        cardHeader.appendChild(platformLabel);
        cardHeader.appendChild(tokenName);
        cardHeader.appendChild(symbolContainer);
        
        // Token image section
        const imageSection = document.createElement('div');
        imageSection.className = 'token-image';
        
        const tokenImage = document.createElement('img');
        tokenImage.src = token.image || `images/${token.platform}logo.png`;
        tokenImage.alt = token.name;
        imageSection.appendChild(tokenImage);
        
        // Token links section
        const linksSection = document.createElement('div');
        linksSection.className = 'token-links';
        
        // View post link
        const viewPostLink = document.createElement('a');
        viewPostLink.href = token.postUrl || '#';
        viewPostLink.className = 'token-link view-post-link';
        viewPostLink.textContent = 'VIEW POST';
        viewPostLink.target = '_blank';
        viewPostLink.style.color = config.accentColor;
        
        // Pump.fun link
        const tradeLink = document.createElement('a');
        tradeLink.href = token.pumpfunUrl || '#';
        tradeLink.className = 'token-link';
        tradeLink.textContent = 'TRADE';
        tradeLink.target = '_blank';
        tradeLink.style.backgroundColor = config.actionColor;
        
        linksSection.appendChild(viewPostLink);
        linksSection.appendChild(tradeLink);
        
        // Timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'timestamp';
        timestamp.textContent = formatTimestamp(token.timestamp);
        timestamp.style.color = config.accentColor;
        
        // Assemble card
        card.appendChild(cardHeader);
        card.appendChild(imageSection);
        card.appendChild(linksSection);
        card.appendChild(timestamp);

        return card;
    }
    
    // Function to update timestamps on all visible token cards
    function updateAllTimestamps() {
        // Get all visible token cards
        const visibleCards = tokenFeed.querySelectorAll('.token-card');
        
        visibleCards.forEach(card => {
            const timestamp = card.querySelector('.timestamp');
            const cardTimestamp = card.getAttribute('data-timestamp');
            
            if (timestamp && cardTimestamp) {
                timestamp.textContent = formatTimestamp(cardTimestamp);
            }
        });
    }
    
    // Update timestamps every minute
    setInterval(updateAllTimestamps, 60000);
    
    // Initialize socket connection
    const socket = io();
    
    // Socket event handlers
    socket.on('connect', () => {
        console.log('Connected to server');
        // Hide loading screen
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        // Show loading screen
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    });
    
    // Initial token load from server when connecting
    socket.on('initialTokens', (tokens) => {
        console.log(`Received ${tokens.length} initial tokens from server`);
        
        // Clear any existing tokens
        allTokens = [];
        
        // Add all tokens to our array
        tokens.forEach(token => {
            allTokens.push(token);
        });
        
        // Display on the current page
        displayTokensForCurrentPage();
        updatePaginationControls();
    });
    
    socket.on('newToken', (token) => {
        console.log('New token received from server:', token);
        addToken(token);
    });
    
    // Listen for admin-created tokens
    socket.on('adminToken', (token) => {
        console.log('Admin token broadcast received:', token);
        
        // Don't play deploy sound if we're the admin who added it
        const isThisAdmin = token.adminId && token.adminId === socket.id;
        
        // Add token with or without sound
        if (isThisAdmin) {
            // We already played the sound when adding it
            allTokens.unshift(token);
            currentPage = 1;
            displayTokensForCurrentPage();
            updatePaginationControls();
        } else {
            // This is from another admin, play sound
            addToken(token);
        }
    });
    
    socket.on('tokenUpdate', (token) => {
        console.log('Token update received:', token);
        
        // Find and update the token in allTokens array
        const tokenIndex = allTokens.findIndex(t => t.id === token.id);
        if (tokenIndex !== -1) {
            allTokens[tokenIndex] = token;
            
            // Update the display if the updated token is on the current page
            const startIndex = (currentPage - 1) * tokensPerPage;
            const endIndex = startIndex + tokensPerPage;
            if (tokenIndex >= startIndex && tokenIndex < endIndex) {
                displayTokensForCurrentPage();
            }
        }
    });
    
    // Listen for token deletion events
    socket.on('deleteToken', (data) => {
        if (data && data.tokenId) {
            console.log('Token deletion request received for:', data.tokenId);
            
            // Find the token index
            const tokenIndex = allTokens.findIndex(t => t.id === data.tokenId);
            
            if (tokenIndex !== -1) {
                // Remove the token from the array
                allTokens.splice(tokenIndex, 1);
                
                // Update the display
                displayTokensForCurrentPage();
                updatePaginationControls();
                
                console.log(`Token ${data.tokenId} deleted`);
                playBeepSound();
            }
        }
    });
    
    // Expose a function to delete tokens
    window.deleteToken = function(tokenId) {
        if (socket && socket.connected) {
            socket.emit('deleteToken', { tokenId });
            console.log(`Sent delete request for token ${tokenId}`);
            return true;
        } else {
            console.warn('Socket not connected, unable to delete token');
            return false;
        }
    };
    
    // Sample tokens data for initial display - this would normally come from the server
    // These will be replaced by real tokens from the platform monitors
    const sampleTokens = [
        {
            id: 'token1',
            name: 'InstaGator',
            symbol: '$GATOR',
            image: 'images/instagator.png',
            postUrl: 'https://instagram.com/p/abc123',
            pumpfunUrl: 'https://pump.fun/abc123',
            platform: 'instagram',
            timestamp: new Date().toISOString()
        },
        {
            id: 'token2',
            name: 'MoonShot',
            symbol: '$MOON',
            image: 'images/moonshot.png',
            postUrl: 'https://twitter.com/status/xyz456',
            pumpfunUrl: 'https://pump.fun/xyz456',
            platform: 'twitter',
            timestamp: new Date().toISOString()
        },
        {
            id: 'token3',
            name: 'ViralKitten',
            symbol: '$KITTEN',
            image: 'images/viral-kitten.png',
            postUrl: 'https://tiktok.com/viral-kitten',
            pumpfunUrl: 'https://pump.fun/viral-kitten',
            platform: 'tiktok',
            timestamp: new Date().toISOString()
        }
    ];
    
    // Initialize token grid
    setupTokenGrid();
    
    // Add sample tokens to demonstrate the UI
    // In the real app, these would be replaced by tokens from the server
    sampleTokens.forEach(token => {
        allTokens.push(token);
    });
    
    // Display initial tokens
    displayTokensForCurrentPage();
    updatePaginationControls();
    
    // Show token guide on first visit
    const tokenGuide = document.getElementById('tokenGuide');
    if (tokenGuide) {
    const closeButton = tokenGuide.querySelector('.close-button');
    
    if (!localStorage.getItem('guideShown')) {
        tokenGuide.style.display = 'block';
        localStorage.setItem('guideShown', 'true');
    }
    
        if (closeButton) {
    closeButton.addEventListener('click', () => {
        tokenGuide.style.display = 'none';
    });
        }
    }
    
    // Expose a function to detect new tokens from external sources
    // This can be used by server APIs to add tokens directly
    window.detectNewToken = function(platform, name, symbol, image, postUrl, pumpfunUrl) {
        // Generate a unique ID for the token
        const id = `token${Date.now()}${Math.floor(Math.random() * 10000)}`;
        
        // Create token object
        const newToken = {
            id: id,
            name: name,
            symbol: symbol,
            image: image,
            postUrl: postUrl || '#',
            pumpfunUrl: pumpfunUrl || '#',
            platform: platform || 'instagram',
            timestamp: new Date().toISOString(),
            adminId: socket.id, // Mark as created by this admin
            isLocal: true // Mark this as a local token that needs to be sent to server
        };
        
        // Initialize global array if it doesn't exist yet
        if (!window.allTokens) {
            window.allTokens = [];
        }
        
        // Add token locally
        return addToken(newToken); // Return ID for reference
    };
    
    // Expose a function to get all tokens for admin panel
    window.getAllTokens = function() {
        return allTokens;
    };
});

// Function to format timestamp
function formatTimestamp(isoString) {
    if (!isoString) return 'JUST NOW';
    
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // Less than 1 minute
        return 'JUST NOW';
    } else if (diff < 3600000) { // Less than 1 hour
        const minutes = Math.floor(diff / 60000);
        return `${minutes}M AGO`;
    } else if (diff < 86400000) { // Less than 1 day
        const hours = Math.floor(diff / 3600000);
        return `${hours}H AGO`;
    } else {
        // For older tokens, show the date
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
} 