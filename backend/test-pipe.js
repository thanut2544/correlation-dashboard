const net = require('net');

const pipeName = '\\\\\\\\.\\\\pipe\\\\mql5_dashboard_feed';
console.log("Connecting to:", pipeName);

const client = net.createConnection(pipeName, () => {
    console.log('Connected to server!');
    const payload = JSON.stringify({
        prices: [
            { symbol: 'EURUSD', price: 1.1234 },
            { symbol: 'GBPUSD', price: 1.2345 }
        ]
    });
    client.write(payload);
    client.end();
});

client.on('error', (err) => {
    console.error('Connection error:', err);
});
