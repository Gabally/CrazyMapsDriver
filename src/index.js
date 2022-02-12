const express = require("express");
const app = express();
const path = require("path");
const WebSocket = require("ws");
const NamesList = require("./text");

const port = process.env.PORT || 3000;

let baseID = 0;

let clientsUsernames = {};

const wss = new WebSocket.Server({
    noServer: true
});

const broadCast = (data, except) => {
    Array.from(wss.clients.values()).forEach(client => {
        if (client.bid !== except) {
            client.send(data);
        }
    });
}

wss.on("connection", (ws, req) => {
    ws.bid = ++baseID;
    Object.keys(clientsUsernames).forEach(k => {
        ws.send(`!${clientsUsernames[k]}|${k}`);
    });
    let username = `${NamesList.adjectives[Math.floor(Math.random() * NamesList.adjectives.length)]}-${NamesList.names[Math.floor(Math.random() * NamesList.names.length)]}`;
    clientsUsernames[ws.bid] = username;
    broadCast(`!${username}|${ws.bid}`, ws.bid);
    ws.on("message", (data) => {
        broadCast(`${ws.bid}|${data}`, ws.bid);
    });
    ws.on("close", () => {
        broadCast(`#${ws.bid}`, ws.bid);
        delete clientsUsernames[ws.bid];
    });
});

app.use(express.static(path.join(__dirname, "public")));

const server = app.listen(port, () => {
    console.log(`Now listening on port ${port}`);
});

server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, socket => {
        wss.emit("connection", socket, request);
    });
});