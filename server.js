const net = require('net');
const JsonSocket = require('json-socket');
const Agenda = require('agenda');


/**
 * Contains preceding messages and its related information as such
 * {messageId = {socket: JsonSocket, request: Object, done: Function}, ...}.
 * @type {Object}
 */
const messages = {};
/**
 * Agenda object, will be initialised in init function.
 * @type {Agenda}
 */
const queue = new Agenda();
/**
 * Tcp server.
 * @type {Server}
 */
const server = net.createServer();


/**
 * Initialises server object, connects to mongo database,
 *  and starts the server on given port.
 *
 * @param port {Number}: tcp port number.
 * @param mongoAddress {String}: mongo database url.
 * @param mongoCollection {String}: mongo database collection name.
 * @param defaultConcurrency {Number}: default concurrent jobs number.
 * @param maxConcurrency {Number}: max concurrent jobs number.
 *
 * @return {Server}: server event emitter object ()
 */
function init(port, mongoAddress, mongoCollection, defaultConcurrency, maxConcurrency) {

    const mongoFullAddress = `mongodb://${mongoAddress}`;
    queue.database(mongoFullAddress, mongoCollection)
        .defaultConcurrency(defaultConcurrency)
        .maxConcurrency(maxConcurrency);
    queue.define('process_message', processMessageJob);
    queue.on('ready', () => queue.start());

    server.on('connection', initSocket);
    server.on('result', sendResult);
    server.listen(port);
    return server;
}


/**
 * Given a connection creates putMessageInQueue function,
 * creates a json socket and initialises it to accept
 * the request with putMessageInQueue function.
 * @param connection {Object}: A tcp connection.
 */
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

/**
 * Given a job and done function, stores done function,
 * reads jobs attributes and call parseRequestAndSend function on them.
 * @param job {Object}: Agenda job.
 * @param done {Object}: job terminating function.
 */
function processMessageJob(job, done) {

    const request = job.attrs.data.request;
    const messageId = job.attrs.data.messageId;

    messages[messageId]['done'] = done;
    parseRequestAndSend(request, messageId);
}

/**
 * Given a request and its id, parses the request, checks if it's ok,
 * and emits the right event.
 * @param request {Object}, request object as specified in readme.
 * @param messageId {String}, id of the given message/request.
 */
function parseRequestAndSend(request, messageId) {

    const clientId = request.clientId;
    const main = request.submission.main;
    const files = request.submission.files;
    const tests = request.submission.tests;
    const timeLimitCompileMs = request.compileTimeoutMs;
    const timeLimitExecutionMs = request.executionTimeoutMs;
    const charactersMaxLength = request.charactersMaxLength;


    if (!((main || tests) && files && timeLimitCompileMs && timeLimitExecutionMs && charactersMaxLength)) {
        sendResult({clientId: clientId});
        return;
    }

    if (!(timeLimitCompileMs > 0 && timeLimitExecutionMs > 0)) {             // illogical values for timeout
        sendResult({clientId: clientId});
        return;
    }


    if (tests && Array.isArray(tests) && tests.length > 0) { // run junit tests

        server.emit('runJunit', messageId, tests, files, timeLimitCompileMs, timeLimitExecutionMs);

    } else {      // run normal java code

        server.emit('runJava', messageId, main, files, timeLimitCompileMs, timeLimitExecutionMs);

    }
}

/**
 * Given a clientId creates an unique messageId.
 *
 * @param message {string} Some random clientId
 * @return {string} clientId + ::: + current date in milliseconds
 */
function createMessageId(message) {

    return `${message.clientId}:::${Date.now()}`;
}


/**
 * Correct and truncates the feedback and sends it back.
 * @param feedback {Object}, feedback/result object as specified in readme or javaBox.js
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


module.exports = init;
