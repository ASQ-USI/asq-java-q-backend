const EventEmitter = require('events');
const Promise = require('bluebird');
const coroutine = Promise.coroutine;
const Docker = Promise.promisifyAll(require('dockerode'));
//TODO: is promisfy applied recursively?????
const concat = require('concat-stream');

//TODO: forgot about archives????

/**
 * @typedef {Object} ExecutionOutput
 * @type ExecutionOutput.messageId {String}
 * @type ExecutionOutput.success {Boolean}
 * @type ExecutionOutput.output {String}
 * @type ExecutionOutput.errorMessage {String}
 * @type ExecutionOutput.timeout {Boolean}
 *
 */

/**
 * Docker object, connected on /var/run/docker.socket or default localhost docker port.
 * @type {Docker}
 */
const docker = new Docker();

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
const runJava = coroutine(function*(messageId, main, tarBuffer, timeLimitCompileMs, timeLimitExecutionMs) {

    const className = main.split('.')[0];

    let container = yield initializeContainer(tarBuffer, messageId);

    const javacCmd = ['javac', '-cp', 'home', `home/${main}`];
    const javaCmd = ['java', '-Djava.security.manager', '-cp', 'home', className];

    try {
        //TODO: Subcalls of coroutines
        const compileOutput = runCommand(javacCmd, container, timeLimitCompileMs);
        if (executedCorrectly(compileOutput)) {

            const runtimeOutput = runCommand(javaCmd, container, timeLimitExecutionMs);
            if (executedCorrectly(runtimeOutput)) {
                emitSuccess(runtimeOutput);

            } else {
                if (runtimeOutput.timeout) emitTimeout(runtimeOutput, 'Runtime');
                else emitWrong(runtimeOutput, 'Runtime');
            }

        } else {
            if (compileOutput.timeout) emitTimeout(compileOutput, 'Compile');
            else emitWrong(compileOutput, 'Compile');
        }


        yield container.kill();
        yield container.remove({v: true});

    } catch (e) { // internal error
        //TODO: specify javaBox behavior for internal error
        console.log('500: Internal error with Docker!');
        emitServerError();
        yield container.kill();
        yield container.remove({v: true});
    }

});


const initializeContainer = coroutine(function*(tarBuffer, messageId) {

    const createOpts = {Image: 'openjdk:8u111-jdk', Tty: true, Cmd: ['/bin/bash']};
    let container = yield docker.createContainerAsync(createOpts);
    container['messageId'] = messageId;

    const startOps = {};
    yield container.startAsync(startOps);

    const tarOptsSource = {path: 'home'};
    yield container.putArchiveAsync(tarBuffer, tarOptsSource);

    return container;
});


/**
 * Run a command inside a container, capture and return output streams and successful execution.
 *
 * @param command {String[]}: A command with arguments to execute
 * @param container {Container}: The container, properly initialised (from initializeContainer), for execution
 * @param executionTimeLimit {Number} [Optional]: The number in milliseconds after which, execution should stop
 * @return The result of the execution indicating if the execution was successful and the output of the stdout/ stderr.
 * @return result {ExecutionOutput}
 * @throws Error
 *
 */
const runCommand = coroutine(function *(command, container, executionTimeLimit) {

    let timeout = null;
    let stdoutData = '';
    let stderrData = '';

    try {                                                                                               // possible errors with docker container
        const execOpts = {Cmd: command, AttachStdout: true, AttachStderr: true, Tty: false};            // execution options
        const exec = yield container.execAsync(execOpts);                                               // create execution of command

        const stream = yield container.attach({stream: true, stdout: true, stderr: true});              // prepare streams
        container.modem.demuxStream(stream, (d) => {
            stdoutData += d
        }, (d) => {
            stderrData += d
        });              // get output chunks                                                        // get stdout and stderr

        yield exec.startAsync();                                                                        // start execution

        if (executionTimeLimit) timeout = setTimeout(throwTimeOutError, executionTimeLimit);            // start keeping time

        yield stream.onAsync('end');   //will this work????????????                                     // wait until finished

        const executionData = yield exec.inspectAsync();                                               // get data of execution
        const executedSuccessfully = (!executionData.Running) ? (executionData.ExitCode == 0) : null;   // set successful execution mark
        // should never be null

        if (executionTimeLimit) clearTimeout(timeout);

        return {
            messageId: container.messageId,
            success: executedSuccessfully,
            output: stdoutData,
            errorMessage: stderrData,
            timeout: false
        }

    } catch (e) {
        container.stop();

        if (e.name == 'timeout') {
            return {
                messageId: container.messageId,
                success: false,
                output: stdoutData,
                errorMessage: stderrData,
                timeout: true
            }
        } else {
            throw e;
        }
    }
});

/**
 * Check if a command executed correctly, by analyzing the result object.
 *
 * @param result {Object || ExecutionOutput}
 * @param result.timeout: {Boolean}
 * @param result.success: {Boolean}
 * @return {boolean}: `true` if command exited with code 0 and no time out occurred, `false` otherwise.
 */
function executedCorrectly(result) {
    return (result.success && !result.timeout);
}

/**
 * Dummy function to raise (throw) a custom timeout error
 * @param stage {String} [Optional]: The stage in which timeout happened.
 * @throws timeout {Object}
 * @type timeout.name {string}
 * @type timeout.stage {string}
 */
function throwTimeOutError(stage) {
    stage = stage || '';
    throw {
        name: 'timeout',
        stage: stage
    };
}


function emitServerError() {
    //TODO: implement
}

/**
 * Emit `result` event with success values.
 *
 * @param executionOutput {ExecutionOutput}: Output of a run command execution
 */
function emitSuccess(executionOutput) {
    const feedback = executionOutput;
    javaBox.emit('result', feedback);
}

/**
 * Emit `result` event with timeout values.
 *
 * @param executionOutput {ExecutionOutput}: Output of a run command execution
 */
function emitTimeout(executionOutput, stage) {
    const feedback = executionOutput;
    feedback.errorMessage = `${stage} timeout reached.`;
    javaBox.emit('result', feedback);
}

/**
 * Emit `result` event with error values.
 *
 * @param executionOutput {ExecutionOutput}: Output of a run command execution
 */
function emitWrong(executionOutput, stage) {
    const feedback = executionOutput;
    javaBox.emit('result', feedback);
}