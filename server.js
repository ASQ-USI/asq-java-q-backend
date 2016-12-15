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
        const timeLimitCompile = message.compileTimeoutMs;
        const timeLimitExecution = message.executionTimeoutMs;
        const charactersMaxLength = message.charactersMaxLength;

        clients[message.clientId] = socket;


        if (!(clientId && files && timeLimitCompile && timeLimitExecution)){
            sendResult({clientId: clientId});
            return;
        }

        if (!(timeLimitCompile > 0 && timeLimitExecution > 0)){             // illogical values for timeout
            sendResult({clientId: clientId});
            return;
        }


        if (message.submission.tests && Array.isArray(message.submission.tests) && message.submission.tests !== []){ // run junit tests

            server.emit('runJunit', clientId, message.submission.tests, files, timeLimitCompile, timeLimitExecution);
        
        }else{      // run normal java code

            if (!main) sendResult({clientId: clientId});

            server.emit('runJava', clientId, main, files, timeLimitCompile, timeLimitExecution);
        }
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
