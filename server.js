const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

let clients = {};

wss.on("connection", function (ws) {
    ws.on("message", function (message) {
        const data = JSON.parse(message);
        switch (data.type) {
            case "login":
                clients[data.name] = ws;
                ws.name = data.name;
                broadcastUserList();
                break;
            case "offer":
            case "answer":
            case "candidate":
            case "leave":
                if (clients[data.target]) {
                    clients[data.target].send(JSON.stringify(data));
                }
                break;
        }
    });

    ws.on("close", function () {
        if (ws.name) {
            delete clients[ws.name];
            broadcastUserList();
        }
    });
});

function broadcastUserList() {
    const names = Object.keys(clients);
    const message = JSON.stringify({ type: "userlist", users: names });
    for (let name in clients) {
        clients[name].send(message);
    }
}

server.listen(3000, () => console.log("Server on http://localhost:3000"));