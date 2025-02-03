const WSS_PING_INTERVAL = 29000;

export default class WebSocketService {
    wss;

    constructor(wss) {
        this.wss = wss;
        this.messageListeners = [];
    }

    connect() {
        // Listen to lifecycle events
        this.wss.on('listening', () => {
            console.log('WS: server listening');
        });
        this.wss.on('error', (error) => {
            console.log(`WS: server error: ${error}`);
        });
        this.wss.on('close', () => {
            console.log('WS: server closed.');
        });

        // Listen for new client connections
        this.wss.on('connection', (wsClient) => {
            console.log(`WS: new client connected (${this.wss.clients.size} online)`);
            wsClient.isAlive = true;

            wsClient.on('message', (message) => {
                const data = JSON.parse(message);
                if (data.type === 'pong') {
                    wsClient.isAlive = true;
                } else {
                    console.log('WS: incomming message ', data);
                    this.messageListeners.forEach((listener) => {
                        listener(wsClient, data);
                    });
                }
            });

            wsClient.on('close', () => {
                console.log('WS" connection closed');
            });
        });

        // Check if WS clients are alive
        setInterval(() => {
            this.wss.clients.forEach((wsClient) => {
                if (!wsClient.isAlive) {
                    console.log('WS: removing inactive client');
                    wsClient.terminate();
                } else {
                    wsClient.isAlive = false;
                    wsClient.send('{"type": "ping"}');
                }
            });
        }, WSS_PING_INTERVAL);
    }

    addMessageListener(listener) {
        this.messageListeners.push(listener);
    }

    /**
     * Broadcasts an object to all WS clients
     * @param {*} data object sent to WS client
     */
    broadcast(data) {
        console.log(
            `WS: broadcasting to ${this.wss.clients.size} client(s): `,
            data
        );
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data, (error) => {
                    if (error) {
                        console.error('WS send error ', error);
                    }
                });
            }
        });
    }
}
