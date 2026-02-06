const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const shortid = require('shortid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ 
    server,
    path: '/ws'
    });

app.use(cors());
app.use(express.json());

// Store active sessions
const sessions = new Map();

// Session timeout in milliseconds (4 hours)
const SESSION_TIMEOUT = 4 * 60 * 60 * 1000;
const MAX_NOTES_LENGTH = 30;
const MAX_ITEM_NAME_LENGTH = 25;
const MAX_ITEM_PRICE = 50000;
const DEFAULT_TAX_PERCENT = 13; // default tax percentage per session
const MAX_TAX_PERCENT = 50; // sanity limit

// Cleanup inactive sessions
function cleanupSessions() {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.createdAt > SESSION_TIMEOUT) {
            // Notify all clients that the session is expired
            console.log(`Session ${sessionId} has expired`);
            console.log(Date.now());
            console.log(sessions.createdAt);
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

// Run cleanup every 10 minutes
setInterval(cleanupSessions, 10 * 60 * 1000);

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
                        createdAt: Date.now(),
                        taxPercent: DEFAULT_TAX_PERCENT,
                    });
                }
                sessions.get(sessionId).clients.add(ws);
                
                // Send current orders to new client
                ws.send(JSON.stringify({
                    type: 'orders',
                    orders: sessions.get(sessionId).orders,
                    taxPercent: sessions.get(sessionId).taxPercent,
                }));
                break;

            case 'add_order':
                if (sessionId && sessions.has(sessionId)) {
                    const session = sessions.get(sessionId);
                    
                    // Validate item name length
                    if (!data.order.item || data.order.item.trim().length > MAX_ITEM_NAME_LENGTH) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Item name must be ${MAX_ITEM_NAME_LENGTH} characters or less`
                        }));
                        return;
                    }

                    // Validate notes length
                    if (data.order.notes && data.order.notes.trim().length > MAX_NOTES_LENGTH) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Notes must be ${MAX_NOTES_LENGTH} characters or less`
                        }));
                        return;
                    }

                    // Validate price if provided
                    if (data.order.price !== undefined) {
                        const price = parseFloat(data.order.price);
                        if (isNaN(price) || price < 0 || price > 50000) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: `Invalid price. Must be between 0 and ${MAX_ITEM_PRICE}`
                            }));
                            return;
                        }
                        // Round to 2 decimal places
                        data.order.price = Math.round(price * 100) / 100;
                    }

                    const order = {
                        id: shortid.generate(),
                        ...data.order,
                        isOrdered: false,
                        timestamp: new Date().toISOString()
                    };
                    session.orders.push(order);
                    
                    // Broadcast to all clients in the session
                    session.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'orders',
                                orders: session.orders,
                                taxPercent: session.taxPercent,
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
                                orders: session.orders,
                                taxPercent: session.taxPercent,
                            }));
                        }
                    });
                }
                break;

            case 'toggle_order_status':
                if (sessionId && sessions.has(sessionId)) {
                    const session = sessions.get(sessionId);
                    const orderIndex = session.orders.findIndex(order => order.id === data.orderId);

                    if (orderIndex !== -1) {
                        // Toggle the isOrdered status
                        const currentStatus = session.orders[orderIndex].isOrdered || false;
                        session.orders[orderIndex].isOrdered = !currentStatus;

                        // Broadcast updated orders to all clients
                        session.clients.forEach((client) => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify({
                                    type: 'orders',
                                    orders: session.orders,
                                    taxPercent: session.taxPercent,
                                }));
                            }
                        });
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Order not found'
                        }));
                    }
                }
                break;

            case 'set_tax':
                if (sessionId && sessions.has(sessionId)) {
                    const session = sessions.get(sessionId);
                    const proposed = parseFloat(data.taxPercent);
                    if (isNaN(proposed) || proposed < 0 || proposed > MAX_TAX_PERCENT) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Invalid tax percent. Must be between 0 and ${MAX_TAX_PERCENT}`
                        }));
                        return;
                    }
                    // Round to 2 decimals
                    session.taxPercent = Math.round(proposed * 100) / 100;

                    // Broadcast updated tax (with current orders) to all clients
                    session.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'orders',
                                orders: session.orders,
                                taxPercent: session.taxPercent,
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
            
            
            // INTERMITTENT CONNECTION DROPs ARE CAUSING SESSIONs TO CLOSE
            // Clean up empty sessions
            // if (session.clients.size === 0) {
            //     sessions.delete(sessionId);
            // }
        }
    });
});

// Create new session
app.post('/api/sessions', (req, res) => {
    const sessionId = generateSessionCode();
    sessions.set(sessionId, {
        orders: [],
        clients: new Set(),
        createdAt: Date.now(),
        taxPercent: DEFAULT_TAX_PERCENT,
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