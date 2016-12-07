const net = require('net');
const JsonSocket = require('json-socket');

var port = 5000;
var host = '127.0.0.1';


function makeConnection(clientId) {

    console.log('make connection');

    var socket = new JsonSocket(new net.Socket());
    socket.connect(port, host);

    socket.on('connect', function() {

        let message = {
            clientId : clientId,
            fileName : 'SomeClass',
            code : 'public class SomeClass {public static void main(String[] args) {System.out.println("Hello world!");}}',
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


for (var i=0; i<100; i++) {
    let clientId = 'client' + i;
    makeConnection(clientId);
};
