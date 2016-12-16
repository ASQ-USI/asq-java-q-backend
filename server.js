const net = require('net');
const JsonSocket = require('json-socket');


const MAX_CONCURRENT_JOBS = 50;
/**
 * @type {Object}
 * Contains preceding messages and its related information as such
 * {messageId = {socket: JsonSocket, request: Object}, ...}
 */
const messages = {};
/**
 * @type {Array}
 * Contains messages in queue and its related information as such :
 * [{messageId: String, socket: JsonSocket, request: Object}, ...]
 */
const messagesQueue = [];


// Server eventEmitter
const server = net.createServer();

server.on('connection', initSocket);
server.on('result', sendResult);


// Init newly created socket
function initSocket(connection) {

    const socket = new JsonSocket(connection);

    const precedeMessage = (request) => {

        const messageId = createMessageId(request);

        if (Object.keys(messages).length <= MAX_CONCURRENT_JOBS) {

            parseRequestAndSend(request, messageId, socket);

        } else {

            messagesQueue.push({messageId: messageId, socket: socket, request: request});
        }
    };

    socket.on('message', precedeMessage);
};

const parseRequestAndSend = (request, messageId, socket) => {

    messages[messageId] = {socket: socket, request: request};

    const clientId = request.clientId;
    const main = request.submission.main;
    const files = request.submission.files;
    const tests = request.submission.tests;
    const timeLimitCompile = request.compileTimeoutMs;
    const timeLimitExecution = request.executionTimeoutMs;
    const charactersMaxLength = request.charactersMaxLength;

    //clients[message.clientId] = {socket: socket, charactersMaxLength: charactersMaxLength};


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

        if (!main) sendResult({clientId: clientId});

        server.emit('runJava', messageId, main, files, timeLimitCompile, timeLimitExecution);

    }
};

/**
 * Correct and truncates the feedback and sends it back.
 * @param feedback {Object}
 */
function sendResult(feedback) {

    const message = messages[feedback.messageId];
    const socket = message.socket;
    const clientId = message.request.clientId;
    const charactersMaxLength = message.request.charactersMaxLength;

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

    sendFromQueue();

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
 * Checks whether there are messages in queue, if yes precedes them
 */
function sendFromQueue() {

    if (messagesQueue.length > 0) {

        const nextMessage = messagesQueue.shift();
        const messageId = nextMessage.messageId;
        const socket = nextMessage.socket;
        const request = nextMessage.request;

        parseRequestAndSend(request, messageId, socket);
    }
}




module.exports = server;
