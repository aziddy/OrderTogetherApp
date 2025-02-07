const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const shortid = require('shortid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Store active sessions
const sessions = new Map();

// Session timeout in milliseconds (2 hours)
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;

// Cleanup inactive sessions
function cleanupSessions() {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.createdAt > SESSION_TIMEOUT) {
            // Notify all clients that the session is expired
            session.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'session_expired',
                        message: 'Session has expired'
                    }));
                    client.close();
                }
            });
            sessions.delete(sessionId);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupSessions, 5 * 60 * 1000);

// Generate a human-readable session code
function generateSessionCode() {
    return shortid.generate().slice(0, 6).toUpperCase();
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    let sessionId = null;

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'join':
                sessionId = data.sessionId;
                if (!sessions.has(sessionId)) {
                    sessions.set(sessionId, {
                        orders: [],
                        clients: new Set(),
                        createdAt: Date.now()
                    });
                }
                sessions.get(sessionId).clients.add(ws);
                
                // Send current orders to new client
                ws.send(JSON.stringify({
                    type: 'orders',
                    orders: sessions.get(sessionId).orders
                }));
                break;

            case 'add_order':
                if (sessionId && sessions.has(sessionId)) {
                    const session = sessions.get(sessionId);
                    const order = {
                        id: shortid.generate(),
                        ...data.order,
                        timestamp: new Date().toISOString()
                    };
                    session.orders.push(order);
                    
                    // Broadcast to all clients in the session
                    session.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'orders',
                                orders: session.orders
                            }));
                        }
                    });
                }
                break;

            case 'remove_order':
                if (sessionId && sessions.has(sessionId)) {
                    const session = sessions.get(sessionId);
                    session.orders = session.orders.filter(order => order.id !== data.orderId);
                    
                    session.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'orders',
                                orders: session.orders
                            }));
                        }
                    });
                }
                break;
        }
    });

    ws.on('close', () => {
        if (sessionId && sessions.has(sessionId)) {
            const session = sessions.get(sessionId);
            session.clients.delete(ws);
            
            // Clean up empty sessions
            if (session.clients.size === 0) {
                sessions.delete(sessionId);
            }
        }
    });
});

// Create new session
app.post('/api/sessions', (req, res) => {
    const sessionId = generateSessionCode();
    sessions.set(sessionId, {
        orders: [],
        clients: new Set(),
        createdAt: Date.now()
    });
    res.json({ sessionId });
});

// Get session info
app.get('/api/sessions/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (session) {
        // Check if session has expired
        if (Date.now() - session.createdAt > SESSION_TIMEOUT) {
            sessions.delete(sessionId);
            res.status(404).json({ exists: false, reason: 'expired' });
        } else {
            res.json({ exists: true });
        }
    } else {
        res.status(404).json({ exists: false, reason: 'not_found' });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 