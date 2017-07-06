const Agenda = require('agenda');

/**
 * @typedef {Agenda} queue
 */
const queue = new Agenda();

/**
 * @typedef {Object} JsonSocket
 * @typedef {Object} Request
 *
 * @typedef {Object} StoredMessage
 * @type StoredMessage.socket: {JsonSocket}
 * @type StoredMessage.request: {Request}
 * @type StoredMessage.done: Function
 */

/**
 * Initialize queue, connect to the database and define actions
 * @param queueParams {Object}
 * @param queueParams.mongoFullAddress {string}
 * @param queueParams.mongoCollection {string}
 * @param queueParams.maxConcurrency {int}
 * @param queueParams.defaultConcurrency {int}
 * @param processMessageJob {Function}: A callback for Agenda.now() for 'process_message' action
 *
 * @return {Promise}: A promise for starting the queue
 */
Agenda.prototype.initialize = function (queueParams, processMessageJob) {

    return new Promise((resolve, reject) => {

        queue.database(queueParams.mongoFullAddress, queueParams.mongoCollection)
            .defaultConcurrency(queueParams.defaultConcurrency)
            .maxConcurrency(queueParams.maxConcurrency);

        queue.define('process_message', processMessageJob);

        queue.on('ready', resolve); // use .then(queue.start())
        queue.on('error', reject);
    });
};

Agenda.prototype.addMessage = function (request) {

    const messageId = createMessageId(request);
    const jobData = {
        messageId: messageId,
        request: request
    };
    queue.now('process_message', jobData);
    return messageId;
};

/**
 * Given a clientId creates an unique messageId.
 *
 * @param message {Object}: connection message
 * @param message.clientId: client UID
 * @return {string} clientId + ::: + current date in milliseconds
 */
function createMessageId(message) {
    return `${message.clientId}:::${Date.now()}`;
}

module.exports = queue;





