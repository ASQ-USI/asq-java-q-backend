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
        const main = message.submission.main;
        const files = message.submission.files;
        const timeLimitCompile = message.timeLimitCompile;
        const timeLimitExecution = message.timeLimitExecution;

        if (!(clientId && main && files)) {
            sendResult({});
        }

        clients[message.clientId] = socket;

        server.emit('runJava', clientId, main, files);
    };

    socket.on('message', parseMessage);
};

function sendResult(feedback) {

    const socket = clients[feedback.clientId];

    try {
        socket.sendEndMessage(feedback);
    } catch (e) {
        console.log('socket closed before sending result back');
    }

}


module.exports = server;
