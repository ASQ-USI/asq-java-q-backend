const net = require('net');
const JsonSocket = require('json-socket');
const fs = require('fs');
const commandLineArgs = require('command-line-args');

const port = 5016;
const host = '127.0.0.1';

/**
 * Command line arguments definition
 * @type {[*]}
 */
const commandLineDef = [
    { name: 'clients', alias: 'c', type: Number, defaultValue: 1},
    {name: 'submission', alias: 's', type: String, defaultValue: 'exceptionPlusOutput'}
];
/**
 * Object that for keys has command line argument names
 * and for values its value.
 * @type {Object}
 */
const commandLine = commandLineArgs(commandLineDef);


/**
 * Creates a simple submission with Main.java class and Main.main method
 * @param command : command to insert in the main method
 * @return {{main: 'Main.java', files: [{name: 'Main.java', data: String}]}}
 */
function simpleSubmission(command) {

    const result = {
        main: 'Main.java',
        files: [{
            name: 'Main.java',
            data: `
        import java.util.*;
        import java.lang.*;
        import java.io.*;
        
        public class Main { public static void main(String[] args) throws java.lang.Exception {
        
        ${command}
        }}`
        }]
    };
    return result;
}
/**
 * Object containing a number of predefined submissions
 * @type {Object}
 */
const submissions = {
    hwSub: simpleSubmission(`System.out.println("Hello world."); `),
    infiniteSub: simpleSubmission(`while (true) { System.out.println("To infinity and beyond!"); }`),
    exceptionPlusOutput: simpleSubmission("System.out.println(\"Standard output message\" ); String s=null; s.toString();"),
    rmSub: {
        main: 'RemoveSub.java',
        files: [{
            name: 'RemoveSub.java',
            data: fs.readFileSync('src/RemoveSub.java', 'utf8')
        }]
    },
    getPropsSub: {
        main: 'GetProps.java',
        files: [{
            name: 'GetProps.java',
            data: fs.readFileSync('src/GetProps.java', 'utf8')
        }]
    },
    junitSub: {
        files: [{
            name: 'MessageUtil.java',
            data: fs.readFileSync('src/MessageUtil.java', 'utf8')
        }],
        tests: [{
            name: 'TestJunit.java',
            data: fs.readFileSync('src/TestJunit.java', 'utf8'),
        }, {
            name: 'TestJunit2.java',
            data: fs.readFileSync('src/TestJunit2.java', 'utf8'),
        }]
    },

};


/**
 * Number of clients to emulate
 */
const clientsNumber = commandLine.clients;
/**
 * The submission to send
 */
const submission = submissions[commandLine.submission];

/**
 * Number of clients left
 */
let clientsLeft = clientsNumber;
/**
 * Given a clientId makes a request on the predefined submission
 * @param clientId {String}
 */
function makeConnection(clientId) {

    const socket = new JsonSocket(new net.Socket());
    socket.connect(port, host);

    socket.on('connect', function() {

        const message = {
            clientId : clientId,
            submission : submission,
            compileTimeoutMs: 6000,
            executionTimeoutMs: 600,
            charactersMaxLength: 1000

        };

        console.time(clientId);

        socket.sendMessage(message);

        socket.on('message', function(message) {

            clientsLeft--;

            console.log(message);
            console.log(message.output);
            console.log(message.errorMessage);
            console.timeEnd(clientId);
            console.log(`Clients left: ${clientsLeft}\n \n`);
        });
    });
}
for (var i = 0; i < clientsNumber; i++) {
    const clientId = 'client' + i;
    makeConnection(clientId);
}
