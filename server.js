const net = require('net');

// Server eventEmitter
const server = net.createServer();

server.on('connection', initSocket);


// Init newly created socket
function initSocket(socket) {

    function parseInputData(data) {
        data = data.trim();

        if (data === 'test docker') {
            server.emit('testDocker', socket);
        }
        else if (data == 'test java') {
            server.emit('testJava', socket);
        }
        else {
            server.emit('runJava', socket, data);
        }
    }

    socket.setEncoding('utf8');

    socket.on('data', parseInputData);
}




module.exports = server;