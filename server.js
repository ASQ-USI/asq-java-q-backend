const net = require('net');
const JsonSocket = require('json-socket');
const Promise = require('bluebird');
const coroutine = Promise.coroutine;

/**
 * @typdef {Object} JsonSocket
 * @typedef {Object} Request
 */

/**
 * "Dictionary" containing preceding messages and its related information as such
 * "messageId" {String} -> {
 *     socket: {JsonSocket},
 *     request: {Request},
 *     done: Function
 * }
 * @type {Object}
 */
const messages = {};
/**
 * Agenda object, will be initialised in init function.
 * @type {Queue}
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
    console.log(`Server listening on port ${port}...`);

    return server;
});


/**
 * When a new connection is established,
 * creates a new socket
 * and inserts request object into the queue for execution.
 * @param connection {Object}: A tcp connection.
 */
function initSocket(connection) {

    const socket = new JsonSocket(connection);
    socket.on('message', addMessageInQueue.bind(null, socket));
}

/**
 * Adds a request from a socket to the queue for execution.
 * @param socket: {JsonSocket}
 * @param request: {Request}
 */
function addMessageInQueue(socket, request) {

    const messageId = queue.addMessage(request);
    messages[messageId] = {socket: socket, request: request};
}

/**
 * Process the execution of a job-request.
 * @param job {Object}: An `Agenda` job.
 * @param done {Function}: A callback to execute when finished, in case the function is asynchronous.
 */
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
/**
 * Checks whether a request is valid or not, given the request specification
 *(See: https://github.com/ASQ-USI/asq-java-q-backend/blob/master/README.md#communication-api)
 * @param request {Request}: The request to be checked.
 * @return {boolean} : Returns `false` if request has one or more missing properties or illogical values, `true` otherwise.
 */
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

/**
 * Sends back to corresponding client error code and closes connection.
 * @param messageId {String}: The id in the queue of the bad request message.
 */
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
 * Executes the request by emitting 'runJunit' or 'runJava' event.
 * @param request {Request}
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
 * Correct and truncates the feedback and sends it back. Also closes connection.
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
