const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let users = {};

wss.on('connection', ws => {
    ws.on('message', msg => {
        const data = JSON.parse(msg);
        switch (data.type) {
            case 'login':
                if (users[data.username]) {
                    ws.send(JSON.stringify({ type: 'login', success: false, message: 'Nom déjà utilisé' }));
                } else {
                    ws.username = data.username;
                    users[data.username] = ws;
                    ws.send(JSON.stringify({
                        type: 'login',
                        success: true,
                        users: Object.keys(users).filter(u => u !== data.username)
                    }));
                    broadcast({ type: 'new-user', username: data.username }, ws);
                }
                break;
            case 'call':
            case 'answer':
            case 'reject':
            case 'ice-candidate':
                if (users[data.to]) {
                    users[data.to].send(JSON.stringify({ ...data, from: ws.username }));
                }
                break;
            case 'disconnect':
                ws.close();
                break;
        }
    });

    ws.on('close', () => {
        if (ws.username) {
            delete users[ws.username];
            broadcast({ type: 'user-disconnected', username: ws.username });
        }
    });
});

function broadcast(data, exclude) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client !== exclude) {
            client.send(JSON.stringify(data));
        }
    });
}

app.use(express.static(path.join(__dirname, 'public')));

server.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});
