const net = require('net');
const JsonSocket = require('json-socket');

const port = 5016;
const host = '127.0.0.1';


function makeConnection(clientId) {

    const socket = new JsonSocket(new net.Socket());
    socket.connect(port, host);

    socket.on('connect', function() {

        const message = {
            clientId : clientId,
            submission : {main: 'Class1.java', files: [
                {
                    name: 'Class1.java',
                    data: 'public class Class1 {public static void main(String[] args) {Class2 c = new Class2(); c.sayHello();}}'
                },
                {
                    name: 'Class2.java',
                    data: 'public class Class2 {public void sayHello() {System.out.println("Hello world!");}}'
                }
            ]}
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
