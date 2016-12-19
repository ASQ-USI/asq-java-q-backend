const EventEmitter = require('events');
const Docker = require('dockerode');
const concat = require('concat-stream');


/**
 * Docker object, connected on /var/run/docker.socket or default localhost docker port.
 * @type {Docker}
 */
const docker = new Docker();

/**
 * Time to wait between checking that the command has been executed (milliseconds).
 * @type {number}
 */
const EXEC_WAIT_TIME_MS = 250;


/**
 * JavaBox eventEmitter.
 * @type {EventEmitter}
 */
const javaBox = new EventEmitter();
/**
 * Initialising javaBox.
 */
javaBox.on('runJava', runJava);
javaBox.on('runJunit', runJunit);


/**
 * Creates a docker container with newly created execution
 * to run the Main.java specified inside the tar.
 *
 * @param messageId {String}: id of the given message/request.
 * @param main {String}: entry point class name.
 * @param tarBuffer {String}: the buffer of the tar containing java files
 * @param timeLimitCompileMs
 * @param timeLimitExecutionMs
 */
function runJava(messageId, main, tarBuffer, timeLimitCompileMs, timeLimitExecutionMs) {

    const className = main.split('.')[0];

    const javacCmd = ['javac', '-cp', 'home', `home/${main}`];
    const javaCmd = ['java', '-Djava.security.manager', '-cp', 'home', className];

    const sourceLocation = tarBuffer;
    const execution = dockerCommand(javacCmd, timeLimitCompileMs, dockerCommand(javaCmd, timeLimitExecutionMs));

    createJContainer(messageId, sourceLocation, false, execution);
}
/**
 * Creates a docker container with newly created execution
 * to run the tests on files to test specified inside the tar.
 *
 * @param messageId {String}: id of the given message/request.
 * @param junitFileNames [String]: array of different junit tests filename.
 * @param tarBuffer {String}: the buffer of the tar containing java files (both test and testing).
 * @param timeLimitCompileMs
 * @param timeLimitExecutionMs
 */
function runJunit(messageId, junitFileNames, tarBuffer, timeLimitCompileMs, timeLimitExecutionMs) {

    let junitFiles = [];
    junitFileNames.forEach((f)=>{
        junitFiles.push( f.name.split('.')[0]);
    });

    const className = 'TestRunner';

    const javacCmd = ['javac', '-cp', 'home:libs/junit-4.12:libs/hamcrest-core-1.3:libs/json-simple-1.1.1'];
    let javaCmd = ['java', '-cp', 'home:libs/junit-4.12:libs/hamcrest-core-1.3:libs/json-simple-1.1.1', className];

    junitFiles.forEach((file)=>{
        javacCmd.push('home/' + file + '.java');
        javaCmd.push(file);
    });


    const sourceLocation = tarBuffer;
    const execution = dockerCommand(javacCmd, timeLimitCompileMs, dockerCommand(javaCmd, timeLimitExecutionMs));

    createJContainer(messageId, sourceLocation, true, execution);
}


/**
 * Creates and starts a container with bash, JDK SE, maybe junit and executes the callback
 * passing the container or error to it.
 *
 * @param messageId {String}: id of the given message/request.
 * @param tarBuffer {String}: the buffer of the tar containing java files.
 * @param isJunit {Boolean}: true if need to create container with junit support.
 * @param callback {function(error, container)}: callback to operate on error and container or data in case of error,
 * should accept two arguments.
 */
function createJContainer(messageId, tarBuffer, isJunit, callback) {

    let copyToCall = 4;

    const tryCallback = (container) => {

        if (copyToCall === 0) {

            callback(null, container);
        }
    };

    const createOpts = {Image: 'openjdk:8u111-jdk', Tty: true, Cmd: ['/bin/bash']};
    docker.createContainer(createOpts, (err, container) => {

        if (err) {callback(err, container); return}

        container['messageId'] = messageId;

        const startOpts = {};
        container.start(startOpts, (err, data) => {

            if (err) {callback(err, data); return}

            if (isJunit) {

                const tarOptsRunner = {path: 'home'};
                container.putArchive('./archives/TestRunner.class.tar', tarOptsRunner, (err, data) => {
                    copyToCall--;
                    if (err) callback(err, data);
                    else tryCallback(container);

                });

                const tarOptsSecureTest = {path: 'home'};
                container.putArchive('./archives/SecureTest.class.tar', tarOptsSecureTest, (err, data) => {
                    copyToCall--;
                    if (err) callback(err, data);
                    else tryCallback(container);

                });

                const tarOptsLibs = {path: '/'};
                container.putArchive('./archives/libs.tar', tarOptsLibs, (err, data) => {
                    copyToCall--;
                    if (err) callback(err, data);
                    else tryCallback(container);
                });
            } else {
                copyToCall = 1;
            }

            const tarOptsSource = {path: 'home'};
            container.putArchive(tarBuffer, tarOptsSource, (err, data) => {
                copyToCall--;
                if (err) callback(err, data);
                else tryCallback(container);
            });
        });
    });
}

/**
 * Given a command, the timeout and the callback, returns a function that on some given container,
 * executes the command, attaches the output listener and runs waitCmdExit.
 *
 * @param command {String}: command to be passed to container runtime environment.
 * @param commandTimeLimitMs {Number}: execution timeout.
 * @param callback {function(err, container)}: function to be executed after the command has finished.
 *
 * @return {function(err, container)}: function that executes the command on a container.
 */
function dockerCommand(command, commandTimeLimitMs, callback) {

    const opts = {Cmd: command, AttachStdout: true, AttachStderr: true};

    const execution = (err, container) => {

        if (!err) container.exec(opts, (err, exec) => {
            exec.start((err, stream) => {

                let stdOut = '';
                let stdErr = '';
                const stdOutConcat = concat({}, (data) => {
                    try {
                        stdOut += data;
                    } catch (e) {
                        stdOut = 'Output larger than 268435440 bytes.';
                    }
                }).on('error', (err) => {});
                const stdErrConcat = concat({}, (data) => {
                    try {
                        stdErr += data;
                    } catch (e) {
                        stdOut = 'Output larger than 268435440 bytes.';
                    }
                }).on('error', (err) => {});

                container.modem.demuxStream(stream, stdOutConcat, stdErrConcat);


                const streamInfo = {

                    getOut: () => {return stdOut},
                    getErr: () => {return stdErr},
                    endStream: () => {
                        stdOutConcat.end();
                        stdErrConcat.end();
                    }
                };

                waitCmdExit(container, exec, callback, streamInfo, commandTimeLimitMs);
            });
        });
    };

    return execution;
}

/**
 * Given an execution of a command on a container, a stream handler and command timeout
 * waits for the command to be finished or timeout to be expired and calls the callback
 * if it isn't null, otherwise it calls the feedbackAndClose function.
 *
 * @param container {Container}: Active docker container.
 * @param exec {Object}: Docker execution object.
 * @param callback {function(err, container)}: function to be executed after the command has finished.
 * @param streamInfo {Object}: returns stdOut, stdIn and closes concat stream
 * @param commandTimeOutMs {Number}: execution timeout in ms.
 * @param previousTimeMs {Number}: ms already spent on this execution, called when the function is called
 * recursively, should not be passed otherwise.
 */
function waitCmdExit(container, exec, callback, streamInfo, commandTimeOutMs, previousTimeMs){

    let timeSpentMs = previousTimeMs || 0;

    const checkExit = (err, data) => {

        if (data.Running) { // command is still running, check later or send time out

            timeSpentMs += EXEC_WAIT_TIME_MS;                             // count time spent

            if (timeSpentMs >= commandTimeOutMs){                           // time period expired

                feedbackAndClose(container, streamInfo, false, true);

            } else {

            waitCmdExit(container, exec, callback, streamInfo, commandTimeOutMs, timeSpentMs);

            }

        } else if ((data.ExitCode === 0) && (callback)) { // command successful, has next command

            callback(null, container);

        } else if (data.ExitCode === 0) { // command successful, it was the last command

            feedbackAndClose(container, streamInfo, true, false)

        } else { // command failed

            feedbackAndClose(container, streamInfo, false, false);
        }
    };

    setTimeout(() => exec.inspect(checkExit), EXEC_WAIT_TIME_MS);
}

/**
 * Closes the stream, parses it assuming it could be a specific junit output,
 * accordingly creates a feedback and emits it, closing and deleting docker container
 * at the end.
 *
 * @param container {Container}: Active docker container.
 * @param streamInfo Object, returns stdOut, stdIn and closes concat stream
 * @param passed Boolean, true if no compile or runtime error during normal execution
 * @param timeOut Boolean, true if timeout time elapsed
 *
 * @feedback
 * if test files exist (junit output) and passed is true:
 * {
 *   messageId,
 *   passed: Boolean (false if compile/runtime errors true otherwise),
 *   output: String,
 *   errorMessage: String (empty if `passed` is true),
 *   timeOut: Boolean,
 *   totalNumberOfTests: Integer,
 *   numberOfTestsPassed: Integer,
 *   testsOutput: String (output of all failed tests)
 * }
 * otherwise:
 * {
 *   messageId,
 *   passed: Boolean (false if compile/runtime errors true otherwise),
 *   output: String,
 *   errorMessage: String (empty if `passed` is false),
 *   timeOut: Boolean
 * }
 */
function feedbackAndClose(container, streamInfo, passed, timeOut) {

    streamInfo.endStream();

    const feedback = {
        messageId: container.messageId,
        passed: passed,
        output: (!timeOut) ? streamInfo.getOut() : '',
        errorMessage: (!timeOut) ? streamInfo.getErr() : "Reached maximum time limit",
        timeOut: timeOut

    };

    const parsed = parseOutput(feedback.output);
    feedback.output = parsed.normalOutput;
    feedback.totalNumberOfTests = parsed.totalNumberOfTests;
    feedback.numberOfTestsPassed = parsed.numberOfTestsPassed;
    feedback.testsOutput = parsed.testsOutput;

    javaBox.emit('result', feedback);

    container.kill({}, () =>
        container.remove({v: true}, () => {}));
}

/**
 * Given a possibly junit output, parses it and if it's junit, adds
 * information about passed tests to the return object.
 *
 * @param output {String}: the stdout of the execution.
 *
 * @return {Object}: Contains stdout and possibly some info about junit tests.
 */
function parseOutput(output){

    const _INPUT_DELIMITER_ = '_!*^&_test-output';

    const outputObject = {};

    outputObject.normalOutput = output.split(_INPUT_DELIMITER_)[0];

    let testOutput = null;

    try {
        testOutput = JSON.parse(output.split(_INPUT_DELIMITER_)[1]);

    } catch(err) {}

    if (testOutput){
        outputObject.totalNumberOfTests  = testOutput.totalNumberOfTests;
        outputObject.numberOfTestsPassed = testOutput.numberOfTestsPassed;
        outputObject.testsOutput         = testOutput.testsOutput;
    }

    return outputObject;
}


module.exports = javaBox;
