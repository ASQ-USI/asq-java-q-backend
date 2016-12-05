const net = require('net');
const JsonSocket = require('json-socket');

var port = 5000;
var host = '127.0.0.1';

var socket = new JsonSocket(new net.Socket());
socket.connect(port, host);

socket.on('connect', function() {

    let message = {
        clientId : '1234',
        fileName : 'someFile',
        code : 'public class Main {public static void main(String[] args) {System.out.println("Hello world!");}}',
        timeLimit : 10
    };

    socket.sendMessage(message);

    socket.on('message', function(message) {
        console.log(message);
        console.log(message.errorMessage);
    });
});
