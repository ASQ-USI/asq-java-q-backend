var net = require('net'),
    JsonSocket = require('json-socket');

var port = 5000; //The same port that the server is listening on
var host = '127.0.0.1';
var socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
socket.connect(port, host);

socket.on('connect', function() { //Don't send until we're connected
    let message = {
        clientId : '1234',
        fileName : 'someFile',
        code : 'public class Main {public static void main(String[] args) {System.out.println("Hello world.");}}',
        timeLimit : 10
    };
    console.log('socket is sending a message');
    socket.sendMessage(message);
    socket.on('message', function(message) {
        console.log('The result is: '+message.result);
    });
});
