const net = require('net');
const JsonSocket = require('json-socket');
const Agenda = require('agenda');


/**
 * Initialising Agenda queue with local Mongo backed persistence,
 * 50 default concurrent jobs and 70 max cuncurrent jobs
 */
const mongoConnectionString = "mongodb://127.0.0.1/queue";
const queue = new Agenda({
    db: {address: mongoConnectionString},
    defaultConcurrency: 50,
    maxConcurrency: 70
});
queue.define('process_message', processMessageJob);
queue.on('ready', () => queue.start());


/**
 * @type {Object}
 * Contains preceding messages and its related information as such
 * {messageId = {socket: JsonSocket, request: Object, done: Function}, ...}
 */
const messages = {};


/**
 * Server eventEmitter
 */
const server = net.createServer();
server.on('connection', initSocket);
server.on('result', sendResult);


// Init newly created socket
function initSocket(connection) {

    const socket = new JsonSocket(connection);

    const putMessageInQueue = (request) => {

        const messageId = createMessageId(request);
        const jobData = {
            messageId: messageId,
            request: request
        };
        messages[messageId] = {socket: socket, request: request};
        queue.now('process_message', jobData);

    };
    socket.on('message', putMessageInQueue);
}

function processMessageJob(job, done) {

    console.log('process message');

    const request = job.attrs.data.request;
    const messageId = job.attrs.data.messageId;

    messages[messageId]['done'] = done;
    parseRequestAndSend(request, messageId);
}

function parseRequestAndSend(request, messageId) {

    const clientId = request.clientId;
    const main = request.submission.main;
    const files = request.submission.files;
    const tests = request.submission.tests;
    const timeLimitCompile = request.compileTimeoutMs;
    const timeLimitExecution = request.executionTimeoutMs;
    const charactersMaxLength = request.charactersMaxLength;


    if (!((main || tests) && files && timeLimitCompile && timeLimitExecution && charactersMaxLength)) {
        sendResult({clientId: clientId});
        return;
    }

    if (!(timeLimitCompile > 0 && timeLimitExecution > 0)) {             // illogical values for timeout
        sendResult({clientId: clientId});
        return;
    }


    if (tests && Array.isArray(tests) && tests.length > 0) { // run junit tests

        server.emit('runJunit', messageId, tests, files, timeLimitCompile, timeLimitExecution);

    } else {      // run normal java code

        server.emit('runJava', messageId, main, files, timeLimitCompile, timeLimitExecution);

    }
}

/**
 * Given a clientId creates an unique messageId
 *
 * @param message {string} Some random clientId
 * @return {string} clientId + ::: + current date in milliseconds
 */
function createMessageId(message) {

    return `${message.clientId}:::${Date.now()}`;
}


/**
 * Correct and truncates the feedback and sends it back.
 * @param feedback {Object}
 */
function sendResult(feedback) {

    const message = messages[feedback.messageId];
    const socket = message.socket;
    const clientId = message.request.clientId;
    const charactersMaxLength = message.request.charactersMaxLength;
    const done = message.done;

    feedback['clientId'] = clientId;

    if (feedback.output.length > charactersMaxLength) {
        feedback.output = feedback.output.substring(0, charactersMaxLength);
    }
    if (feedback.errorMessage.length > charactersMaxLength) {
        feedback.errorMessage = feedback.errorMessage.substring(5, charactersMaxLength);
    }

    try {
        socket.sendEndMessage(feedback);
    } catch (e) {
        console.log('socket closed before sending result back');
    }

    done();
}


module.exports = server;
