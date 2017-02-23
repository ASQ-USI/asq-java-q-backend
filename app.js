const tar = require('tar-stream');
const fs = require('fs');
const commandLineArgs = require('command-line-args');
const Promise = require('bluebird');
const coroutine = Promise.coroutine;


/**
 * Command line arguments definition
 * @type {[*]}
 */
const commandLineDef = [
    { name: 'port', alias: 'p', type: Number, defaultValue: 5016},
    { name: 'mongoAddress', alias: 'a', type: String, defaultValue: '127.0.0.1/queue'},
    { name: 'mongoCollection', alias: 'c', type: String, defaultValue: 'agendaJobs'},
    { name: 'defaultConcurrency', alias: 'd', type: Number, defaultValue: 40},
    { name: 'maxConcurrency', alias: 'm', type: Number, defaultValue: 70}
];
/**
 * Object that for keys has command line argument names
 * and for values its value.
 * @type {Object}
 */
const commandLine = commandLineArgs(commandLineDef);


/**
 * Server specified in server.js
 * @type {Server}
 */
const server = require('./server')(
    commandLine.port,
    commandLine.mongoAddress,
    commandLine.mongoCollection,
    commandLine.defaultConcurrency,
    commandLine.maxConcurrency
);
/**
 * Object controlling docker specified in javaBox.js
 * @type {EventEmitter}
 */
const javaBox = require('./javaBox');

/**
 * Given code to execute and info about it,
 * creates a tar with the code and passed the info and the tar to javaBox.
 *
 * @param messageId {String}: id of the given message/request.
 * @param main {String}: entry point class name.
 * @param files {{name: String, data: String}[]}: array of objects with filename and its content
 * @param timeLimitCompileMs {Number}: Compilation timeout.
 * @param timeLimitExecutionMs {Number}: Execution timeout.
 */
const runJava = coroutine(function*(messageId, main, files, timeLimitCompileMs, timeLimitExecutionMs) {

    const pack = tar.pack();
    const packEntry = Promise.promisify(pack.entry, {context: pack});

    Promise.map(files, function (file) {
        return packEntry({name: file.name}, file.data);

    }).then(function () {
        const tarBuffer = pack.read();
        javaBox.emit('runJava', messageId, main, tarBuffer, timeLimitCompileMs, timeLimitExecutionMs);

    });

});
/**
 * Given code to execute and to test and info about it,
 * creates a tar with the code and passed the info and the tar to javaBox.
 *
 * @param messageId {String}: id of the given message/request.
 * @param tests [{name: {String}, data: {String]: array of objects with filename and its content.
 * @param files [{name: {String}, data: {String]: array of objects with filename and its content.
 * @param timeLimitCompileMs {Number}: Compilation timeout.
 * @param timeLimitExecutionMs {Number}: Execution timeout.
 */
const runJunit = coroutine(function *(messageId, tests, files, timeLimitCompileMs, timeLimitExecutionMs) {

    files = files.concat(tests);

    const pack = tar.pack();
    const packEntry = Promise.promisify(pack.entry, {context: pack});

    Promise.map(files, function (file) {
        return packEntry({name: file.name}, file.data);

    }).then(function () {
        const tarBuffer = pack.read();
        javaBox.emit('runJunit', messageId, junitFileNames, tarBuffer, timeLimitCompileMs, timeLimitExecutionMs);

    });

});

/**
 * Given the feedback object passes it to the server.
 * @param feedback {Object}, feedback/result object as specified in readme or javaBox.js
 */
function giveFeedBack(feedback) {

    server.emit('result', feedback);
}

/**
 * Specifying the server and javaBox control flow
 */
server.on('runJunit', runJunit);
server.on('runJava', runJava);
javaBox.on('result', giveFeedBack);
