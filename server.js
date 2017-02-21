const net = require('net');
const JsonSocket = require('json-socket');
const Promise = require('bluebird');
const coroutine = Promise.coroutine;

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
const queue = require('./queue');

/**
 * @typedef {Object} Server
 */
/**
 * Tcp server.
 * @type {Server}
 */
const server = net.createServer();
//TODO: is this correct?
server.listen = Promise.promisify(server.listen);



/**
 * Initialises server and queue for storing requests.
 *
 * @param port {Number}: tcp port number.
 * @param mongoAddress {String}: mongo database url.
 * @param mongoCollection {String}: mongo database collection name.
 * @param defaultConcurrency {Number}: default concurrent jobs number.
 * @param maxConcurrency {Number}: max concurrent jobs number.
 *
 * @return {Server}: server event emitter object ()
 */
const init = coroutine(function*(port, mongoAddress, mongoCollection, defaultConcurrency, maxConcurrency) {

    const mongoFullAddress = `mongodb://${mongoAddress}`;
    const queueInitParams = {
        mongoFullAddress,
        mongoCollection,
        maxConcurrency,
        defaultConcurrency
    };
    yield queue.initialize(queueInitParams, processMessageJob);
    queue.start();


    server.on('connection', initSocket);
    server.on('result', sendResult);

    yield server.listen(port);
    console.log(`server listening on port ${port}...`);

    return server;
});


/**
 * Given a connection creates putMessageInQueue function,
 * creates a json socket and initialises it to accept
 * the request with putMessageInQueue function.
 * @param connection {Object}: A tcp connection.
 */
function initSocket(connection) {

    const socket = new JsonSocket(connection);
    socket.on('message', addMessageInQueue.bind(null, socket));
}

function addMessageInQueue(socket, request) {

    const messageId = queue.addMessage(request);
    messages[messageId] = {socket: socket, request: request};
}


function processMessageJob(job, done) {

    const request = job.attrs.data.request;
    const messageId = job.attrs.data.messageId;

    messages[messageId]['done'] = done;

    if (isRequestValid(request)) {
        executeRequest(request, messageId);

    } else {
        sendResultForBadRequest(messageId);
    }

    done(); // not needed, useful for async code
}

function isRequestValid(request) {
    const main = request.submission.main;
    const files = request.submission.files;
    const tests = request.submission.tests;
    const timeLimitCompileMs = request.compileTimeoutMs;
    const timeLimitExecutionMs = request.executionTimeoutMs;
    const charactersMaxLength = request.charactersMaxLength;

    if (!((main || tests) && files && timeLimitCompileMs && timeLimitExecutionMs && charactersMaxLength)) { // absence of parameter
        return false;
    } else if (!(timeLimitCompileMs > 0 && timeLimitExecutionMs > 0)) {             // illogical values for timeout
        return false;
    } else {
        return true;
    }
}

function sendResultForBadRequest(messageId) {
    const message = messages[messageId];
    const socket = message.socket;
    const clientId = message.request.clientId;
    try {
        socket.sendEndMessage({}); //TODO: define output for bad requests
    } catch (e) {
        console.log(`73: Socket with client ${clientId} closed before sending result back.`);
    }
}

/**
 * Given a request and its id, parses the request, checks if it's ok,
 * and emits the right event.
 * @param request {Object}, request object as specified in readme.
 * @param messageId {String}, id of the given message/request.
 */
function executeRequest(request, messageId) {

    const main = request.submission.main;
    const files = request.submission.files;
    const tests = request.submission.tests;
    const timeLimitCompileMs = request.compileTimeoutMs;
    const timeLimitExecutionMs = request.executionTimeoutMs;


    if (tests && Array.isArray(tests) && tests.length > 0) { // run junit tests

        server.emit('runJunit', messageId, tests, files, timeLimitCompileMs, timeLimitExecutionMs);

    } else {      // run normal java code

        server.emit('runJava', messageId, main, files, timeLimitCompileMs, timeLimitExecutionMs);

    }
}
/**
 * Correct and truncates the feedback and sends it back.
 * @param feedback {Object}: feedback/result object as specified in readme or javaBox.js
 * @param feedback.messageId {string}
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
        console.log(`73: Socket with client ${clientId} closed before sending result back.`);
    }

    done();
}


module.exports = init;
