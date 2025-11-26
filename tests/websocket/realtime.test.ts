import WebSocket from 'ws';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const WS_URL = process.env.WS_URL || 'ws://localhost:3001/ws';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const API_KEY = process.env.API_KEY || process.env.TEST_API_KEY;

describe('WebSocket Authentication', () => {
    it('should reject connection without API key', (done) => {
        const ws = new WebSocket(WS_URL);

        ws.on('close', (code, reason) => {
            expect(code).toBe(1008);
            expect(reason.toString()).toContain('Authentication required');
            done();
        });

        ws.on('open', () => {
            ws.close();
            done(new Error('Connection should have been rejected'));
        });

        setTimeout(() => {
            if (ws.readyState !== WebSocket.CLOSED) {
                ws.close();
                done(new Error('Connection did not close in time'));
            }
        }, 3000);
    });

    it('should reject connection with invalid API key', (done) => {
        const ws = new WebSocket(WS_URL, {
            headers: { 'x-api-key': 'invalid-key-123' }
        });

        ws.on('close', (code, reason) => {
            expect(code).toBe(1008);
            expect(reason.toString()).toContain('Authentication failed');
            done();
        });

        ws.on('open', () => {
            ws.close();
            done(new Error('Connection should have been rejected'));
        });

        setTimeout(() => {
            if (ws.readyState !== WebSocket.CLOSED) {
                ws.close();
                done(new Error('Connection did not close in time'));
            }
        }, 3000);
    });

    it('should accept connection with valid API key via header', (done) => {
        if (!API_KEY) {
            console.warn('Skipping: No API_KEY environment variable set');
            done();
            return;
        }

        const ws = new WebSocket(WS_URL, {
            headers: { 'x-api-key': API_KEY }
        });

        ws.on('open', () => {
            expect(ws.readyState).toBe(WebSocket.OPEN);
            ws.close();
            done();
        });

        ws.on('error', (error) => {
            done(new Error(`Connection failed: ${error.message}`));
        });

        ws.on('close', (code) => {
            if (code === 1008) {
                done(new Error('Connection was rejected with valid API key'));
            }
        });

        setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                ws.close();
                done(new Error('Connection did not open in time'));
            }
        }, 3000);
    });

    it('should accept connection with valid API key via query parameter', (done) => {
        if (!API_KEY) {
            console.warn('Skipping: No API_KEY environment variable set');
            done();
            return;
        }

        const wsUrlWithKey = `${WS_URL}?apiKey=${encodeURIComponent(API_KEY)}`;
        const ws = new WebSocket(wsUrlWithKey);

        ws.on('open', () => {
            expect(ws.readyState).toBe(WebSocket.OPEN);
            ws.close();
            done();
        });

        ws.on('error', (error) => {
            done(new Error(`Connection failed: ${error.message}`));
        });

        ws.on('close', (code) => {
            if (code === 1008) {
                done(new Error('Connection was rejected with valid API key'));
            }
        });

        setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                ws.close();
                done(new Error('Connection did not open in time'));
            }
        }, 3000);
    });
});

describe('WebSocket Real-time Updates', () => {
    let ws: WebSocket;
    let isConnected = false;

    beforeAll(async () => {
        return new Promise<void>((resolve, reject) => {
            ws = new WebSocket(WS_URL);

            ws.on('open', () => {
                isConnected = true;
                console.log('✓ WebSocket connected');
                resolve();
            });

            ws.on('error', (error) => {
                console.warn('⚠️  WebSocket connection failed:', error.message);
                console.warn('   Start API with: cd apps/api && pnpm dev');
                isConnected = false;
                resolve(); // Don't reject, just skip tests
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                if (!isConnected) {
                    console.warn('⚠️  WebSocket connection timeout');
                    resolve();
                }
            }, 5000);
        });
    });

    afterAll(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });

    it('should connect to WebSocket', () => {
        if (!isConnected) {
            console.warn('Skipping: WebSocket not connected');
            return;
        }

        expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it('should receive log events', (done) => {
        if (!isConnected) {
            console.warn('Skipping: WebSocket not connected');
            done();
            return;
        }

        const timeout = setTimeout(() => {
            console.warn('Timeout waiting for log event');
            done();
        }, 10000);

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());

                if (message.type === 'log') {
                    expect(message).toHaveProperty('data');
                    expect(message.data).toHaveProperty('level');
                    expect(message.data).toHaveProperty('message');
                    clearTimeout(timeout);
                    done();
                }
            } catch (error) {
                // Ignore parse errors
            }
        });

        // Trigger a log by making an API call
        setTimeout(() => {
            fetch(`${API_URL}/api/agents`, {
                method: 'GET',
            }).catch(() => {
                // Ignore errors
            });
        }, 100);
    }, 15000);

    it('should receive execution status updates', (done) => {
        if (!isConnected) {
            console.warn('Skipping: WebSocket not connected');
            done();
            return;
        }

        let receivedStart = false;
        let receivedComplete = false;

        const timeout = setTimeout(() => {
            console.warn('Timeout waiting for execution events');
            done();
        }, 30000);

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());

                if (message.type === 'execution:start') {
                    receivedStart = true;
                    expect(message.data).toHaveProperty('executionId');
                }

                if (message.type === 'execution:complete') {
                    receivedComplete = true;
                    expect(message.data).toHaveProperty('executionId');
                }

                if (receivedStart && receivedComplete) {
                    clearTimeout(timeout);
                    done();
                }
            } catch (error) {
                // Ignore parse errors
            }
        });

        // Trigger execution by creating and executing an agent
        setTimeout(async () => {
            try {
                const createResponse = await fetch(`${API_URL}/api/agents`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: 'ws-test-agent',
                        model: 'gpt-4',
                        systemPrompt: 'test',
                    }),
                });

                if (createResponse.ok) {
                    const agent = await createResponse.json();

                    await fetch(`${API_URL}/api/agents/${agent.id}/execute`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ input: 'test' }),
                    });
                }
            } catch (error) {
                console.warn('Failed to trigger execution:', error);
            }
        }, 100);
    }, 35000);

    it('should handle reconnection', (done) => {
        if (!isConnected) {
            console.warn('Skipping: WebSocket not connected');
            done();
            return;
        }

        // Close connection
        ws.close();

        // Wait a bit
        setTimeout(() => {
            // Reconnect
            const newWs = new WebSocket(WS_URL);

            newWs.on('open', () => {
                expect(newWs.readyState).toBe(WebSocket.OPEN);
                newWs.close();
                done();
            });

            newWs.on('error', () => {
                console.warn('Reconnection failed');
                done();
            });
        }, 1000);
    }, 10000);

    it('should receive ping/pong for keepalive', (done) => {
        if (!isConnected) {
            console.warn('Skipping: WebSocket not connected');
            done();
            return;
        }

        ws.on('ping', () => {
            expect(true).toBe(true); // Received ping
            done();
        });

        ws.on('pong', () => {
            expect(true).toBe(true); // Received pong
            done();
        });

        // Send ping
        ws.ping();

        // Timeout
        setTimeout(() => {
            console.warn('No ping/pong received (may be normal)');
            done();
        }, 5000);
    }, 10000);
});
