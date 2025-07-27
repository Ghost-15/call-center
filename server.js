const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

let clients = {};

wss.on('connection', function (ws) {
    ws.on('message', function (msg) {
        const data = JSON.parse(msg);

        switch (data.type) {
            case 'login':
                if (clients[data.name]) {
                    ws.send(JSON.stringify({ type: 'login', success: false }));
                } else {
                    ws.name = data.name;
                    clients[data.name] = ws;
                    ws.send(JSON.stringify({ type: 'login', success: true, users: Object.keys(clients) }));
                    broadcast({ type: 'update-users', users: Object.keys(clients) });
                }
                break;

            case 'offer':
            case 'answer':
            case 'ice':
            case 'call-request':
            case 'call-response':
                const target = clients[data.to];
                if (target) {
                    target.send(JSON.stringify(data));
                }
                break;

            case 'leave':
                handleDisconnect(ws);
                break;
        }
    });

    ws.on('close', function () {
        handleDisconnect(ws);
    });
});

function broadcast(data) {
    Object.values(clients).forEach(client => {
        client.send(JSON.stringify(data));
    });
}

function handleDisconnect(ws) {
    if (ws.name) {
        delete clients[ws.name];
        broadcast({ type: 'update-users', users: Object.keys(clients) });
    }
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
