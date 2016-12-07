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

        if (!(clientId && fileName && code && timeLimit)) {
            console.log('invalid message:');
            console.log(message);
            sendResult({});
        }

        clients[message.clientId] = socket;

        server.emit('runJava', clientId, fileName, code);
    };

    socket.on('message', parseMessage);
};

function sendResult(feedback) {

    console.log('sending result');

    let socket = clients[feedback.clientId];

    try {
        socket.sendEndMessage(feedback);
    } catch (e) {
        console.log('socket closed before sending result back');
    }

}


module.exports = server;
