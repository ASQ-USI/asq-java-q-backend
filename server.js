const net = require('net');
const JsonSocket = require('json-socket');


// Object containing clients list and relative sockets
const clients = {};

// Server eventEmitter
const server = net.createServer();

server.on('connection', initSocket);
server.on('result', sendResult);


// Init newly created socket
function initSocket(connection) {

    const socket = new JsonSocket(connection);

    const parseMessage = (message) => {

        const clientId = message.clientId;
        const fileName = message.fileName;
        const code = message.code;
        const timeLimit = message.timeLimit;

        if (!(clientId && fileName && code && timeLimit)) {
            sendResult({});
        }

        clients[message.clientId] = socket;

        server.emit('runJava', clientId, fileName, code);
    };

    socket.on('message', parseMessage);
};

function sendResult(feedback) {

    const socket = clients[feedback.clientId];

    socket.sendEndMessage(feedback);
}


module.exports = server;
