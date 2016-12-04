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

    let socket = new JsonSocket(connection);

    let parseMessage = (message) => {

        let clientId = message.clientId;
        let fileName = message.fileName;
        let code = message.code;
        let timeLimit = message.timeLimit;

        clients[clientId] = socket;

        server.emit('runJava', clientId, code);
    };

    socket.on('message', parseMessage);
};

function sendResult(clientId) {

    let socket = clients.clientId;

    let response = {
        clientId: clientId,
        passed : passed,
        ouptut : output,
        errorMessage : error,
        timeOut : false
    };

    socket.sendEndMessage(response);
}


module.exports = server;
