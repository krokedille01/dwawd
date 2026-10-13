const express = require('express');
const cors = require('cors');
const { SignClient } = require('@walletconnect/sign-client');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// WalletConnect client
let signClient = null;

// Initialize WalletConnect Sign Client
async function initWalletConnect() {
    try {
        signClient = await SignClient.init({
            projectId: '70b641f93d5906dc2154644956443ba6',
            metadata: {
                name: 'My DApp',
                description: 'DApp with WalletConnect',
                url: 'https://localhost:3000',
                icons: ['https://localhost:3000/favicon.ico']
            }
        });
        console.log('✅ WalletConnect initialized');
    } catch (error) {
        console.error('❌ WalletConnect init failed:', error);
    }
}

// Store pending approvals
const pendingApprovals = new Map();

// Endpoint to disconnect/clear session
app.post('/api/disconnect', async (req, res) => {
    try {
        // Disconnect existing session if any
        if (app.locals.wcSession && signClient) {
            try {
                await signClient.disconnect({
                    topic: app.locals.wcSession.topic,
                    reason: { code: 1, message: 'User disconnected' }
                });
                console.log('✅ Disconnected existing WalletConnect session');
            } catch (error) {
                console.log('⚠️ Error disconnecting session (may already be disconnected):', error.message);
            }
        }
        
        // Clear session
        app.locals.wcSession = null;
        pendingApprovals.clear();
        
        res.json({ success: true, message: 'Session disconnected' });
    } catch (error) {
        console.error('❌ Disconnect failed:', error);
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

// Endpoint to create a new WalletConnect session
app.post('/api/connect', async (req, res) => {
    try {
        if (!signClient) {
            return res.status(500).json({ error: 'WalletConnect not initialized' });
        }

        // Disconnect existing session before creating new one
        if (app.locals.wcSession) {
            try {
                await signClient.disconnect({
                    topic: app.locals.wcSession.topic,
                    reason: { code: 1, message: 'Starting new connection' }
                });
                console.log('🔄 Disconnected old session before creating new one');
            } catch (error) {
                console.log('⚠️ Error disconnecting old session:', error.message);
            }
            app.locals.wcSession = null;
            pendingApprovals.clear();
        }

        // Create a new pairing
        const { uri, approval } = await signClient.connect({
            requiredNamespaces: {
                eip155: {
                    methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign'],
                    chains: ['eip155:1'],
                    events: ['chainChanged', 'accountsChanged']
                }
            }
        });

        // Store the approval promise
        const topic = 'pending_' + Date.now();
        pendingApprovals.set(topic, approval);

        // Wait for approval in background
        approval().then((session) => {
            console.log('✅ WalletConnect session approved!', session);
            // Store session for later use
            app.locals.wcSession = session;
            pendingApprovals.delete(topic);
        }).catch((error) => {
            console.error('❌ WalletConnect approval failed:', error);
            pendingApprovals.delete(topic);
        });

        res.json({
            uri: uri,
            topic: topic,
            expires: Math.floor(Date.now() / 1000) + (86400 * 7)
        });

    } catch (error) {
        console.error('❌ Connection failed:', error);
        res.status(500).json({ error: 'Failed to create connection' });
    }
});

// Endpoint to check session status
app.get('/api/session', (req, res) => {
    const session = app.locals.wcSession;
    res.json({ 
        connected: !!session,
        accounts: session?.namespaces?.eip155?.accounts || []
    });
});

// Endpoint to proxy blockchain calls (bypasses CORS)
app.post('/api/rpc', async (req, res) => {
    try {
        const { method, params, id } = req.body;
        
        console.log(`📞 RPC call: ${method}`);
        
        const response = await fetch('https://eth.llamarpc.com', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: id || 1,
                method: method,
                params: params
            })
        });
        
        const data = await response.json();
        
        // Return in ethers.js expected format
        res.json(data.result);
    } catch (error) {
        console.error('❌ RPC call failed:', error);
        res.status(500).json({ error: 'RPC call failed' });
    }
});

// Endpoint to send smart contract transaction via WalletConnect
app.post('/api/sendTransaction', async (req, res) => {
    try {
        if (!signClient) {
            return res.status(500).json({ error: 'WalletConnect not initialized' });
        }

        const session = app.locals.wcSession;
        if (!session) {
            return res.status(400).json({ error: 'No active session' });
        }

        const { to, data, value } = req.body;

        // Send transaction via WalletConnect
        const txHash = await signClient.request({
            topic: session.topic,
            chainId: 'eip155:1',
            request: {
                method: 'eth_sendTransaction',
                params: [
                    {
                        from: session.namespaces.eip155.accounts[0].split(':')[2],
                        to: to,
                        data: data,
                        value: value || '0x0'
                    }
                ]
            }
        });

        res.json({ txHash });
    } catch (error) {
        console.error('❌ Send transaction failed:', error);
        res.status(500).json({ error: 'Failed to send transaction' });
    }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 API endpoints available:`);
    console.log(`   POST http://localhost:${PORT}/api/connect`);
    console.log(`   GET  http://localhost:${PORT}/api/session`);
    console.log(`   POST http://localhost:${PORT}/api/sendTransaction`);
    
    // Initialize WalletConnect in background (non-blocking)
    initWalletConnect().catch(err => {
        console.error('⚠️ WalletConnect init error (server still running):', err.message);
    });
});
