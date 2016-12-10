const net = require('net');
const JsonSocket = require('json-socket');

const port = 5000;
const host = '127.0.0.1';


function makeConnection(clientId) {

    const socket = new JsonSocket(new net.Socket());
    socket.connect(port, host);

    socket.on('connect', function() {

        const message = {
            clientId : clientId,
            fileName : 'Mainone.java',
            code : 'public class Mainone {public static void main(String[] args) {System.out.println("Hello world!");}}',
            timeLimit : 10
        };

        socket.sendMessage(message);

        socket.on('message', function(message) {
            console.log(message);
            console.log(message.output);
            console.log(message.errorMessage);
        });
    });
};


for (var i=0; i<1; i++) {
    const clientId = 'client' + i;
    makeConnection(clientId);
};
