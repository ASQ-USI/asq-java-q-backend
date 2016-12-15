const net = require('net');
const JsonSocket = require('json-socket');


// Object containing clients list and relative information as such
// {clientId: {socket: ..., charactersMaxLength: ...}, ...}
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
        const timeLimitCompile = message.compileTimeoutMs;
        const timeLimitExecution = message.executionTimeoutMs;
        const charactersMaxLength = message.charactersMaxLength;

        clients[message.clientId] = {socket: socket, charactersMaxLength: charactersMaxLength};


        if (!(clientId && main && files && timeLimitCompile && timeLimitExecution && charactersMaxLength)){
            sendResult({clientId: clientId});
            return;
        }

        if (!(timeLimitCompile > 0 && timeLimitExecution > 0)){             // illogical values for timeout
            sendResult({clientId: clientId});
            return;
        }



        server.emit('runJava', clientId, main, files, timeLimitCompile, timeLimitExecution);
    };

    socket.on('message', parseMessage);
};

function sendResult(feedback) {

    const client = clients[feedback.clientId];
    const socket = client.socket;
    const charactersMaxLength = client.charactersMaxLength;

    if (feedback.output.length > charactersMaxLength) {
        console.log('trunkating');
        feedback.output = feedback.output.substring(0, charactersMaxLength);
    }
    if (feedback.errorMessage.length > charactersMaxLength) {
        feedback.errorMessage = feedback.output.substring(0, charactersMaxLength);
    }

    try {
        socket.sendEndMessage(feedback);
    } catch (e) {
        console.log('socket closed before sending result back');
    }

}


module.exports = server;
