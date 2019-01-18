const EventEmitter = require('events');
const Promise = require('bluebird');
const coroutine = Promise.coroutine;
//const Docker = Promise.promisifyAll(require('dockerode'));
const Docker = require('dockerode');
const concat = require('concat-stream');
const OutputStream = require('./containerOutputStream');
const schedule = require('node-schedule');


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
const docker = Promise.promisifyAll(new Docker());

/**
 * Docker containers that can be reused.
 * TODO: tweak the size in a smarter way, as well as pre-populate it
 * @type {Array}
 */
const javaContainers = Promise.promisifyAll(new Array());
const jUnitContainers = Promise.promisifyAll(new Array());

/**
 * Maximum of number containers to be available. This should be the same value as the maximum number of concurrent computations accepted
 * TODO: tweak the size in a smarter way, as well as pre-populate it
 * @type {Inf}
 */
const maxContainers = 20;

/**
 * JavaBox eventEmitter.
 * @type {EventEmitter}
 */
const javaBox = new EventEmitter();


/**
 * Creates a docker container with newly created execution
 * to run the Main.java specified inside the tar.
 *
 * @param {String} messageId : id of the given message/request.
 * @param {String} main : entry point class name.
 * @param {String} tarBuffer : the buffer of the tar containing java files
 * @param {Number} timeLimitCompileMs
 * @param {Number} timeLimitExecutionMs
 */
const runJava = coroutine(function*(messageId, main, tarBuffer, timeLimitCompileMs, timeLimitExecutionMs) {

    const className = main.split('.')[0];

    let container = yield getContainer(tarBuffer, messageId);

    const javacCmd = ['javac', '-cp', 'home', `home/${main}`];
    const javaCmd = ['java', '-Djava.security.manager', '-cp', 'home', className];

    try {
        const compileOutput = yield runCommand(javacCmd, container, timeLimitCompileMs, 'compilation');

        if (executedCorrectly(compileOutput)) {


            const runtimeOutput = yield runCommand(javaCmd, container, timeLimitExecutionMs, 'execution');

            if (executedCorrectly(runtimeOutput)) {
                //TODO: maybe also return compileOutput for warnings?
                emitSuccess(runtimeOutput);

            } else {
                if (runtimeOutput.timeout) emitTimeout(runtimeOutput, 'execution');
                else emitWrong(runtimeOutput, 'Runtime');
            }

        } else {
            if (compileOutput.timeout) emitTimeout(compileOutput, 'compilation');
            else emitWrong(compileOutput, 'Compile');
        }

        // Now we reuse healty containers, if we are below the maxContainers number
        // yield container.stopAsync();
        // yield container.removeAsync({f: true});
        yield reuseOrDisposeContainer(container, false);


    } catch (e) { // internal error
        //TODO: specify javaBox behavior for internal error
        console.log('500: Internal error with Docker!');
        emitServerError(e);
        yield container.killAsync({t: 0});
        yield container.removeAsync({v: true, force: true});
    }

});


const runJunit = coroutine(function*(messageId, junitFileNames, tarBuffer, timeLimitCompileMs, timeLimitExecutionMs) {

    let junitFiles = [];
    junitFileNames.forEach((f)=>{
        junitFiles.push( f.name.split('.')[0]);
    });

    const className = 'TestRunner';

    let container = yield getContainer(tarBuffer, messageId, true);

    const javacCmd = ['javac', '-cp', 'home:libs:libs/junit-4.12:libs/hamcrest-core-1.3:libs/json-simple-1.1.1'];
    let javaCmd = ['java', '-cp', 'home:libs:libs/junit-4.12:libs/hamcrest-core-1.3:libs/json-simple-1.1.1', className];

    junitFiles.forEach((file)=>{
        javacCmd.push('home/' + file + '.java');
        javaCmd.push(file);
    });

    try {
        const compileOutput = yield runCommand(javacCmd, container, timeLimitCompileMs, 'compilation');
        if (executedCorrectly(compileOutput)) {

            const runtimeOutput = yield runCommand(javaCmd, container, timeLimitExecutionMs, 'execution');
            if (executedCorrectly(runtimeOutput)) {
                emitSuccess(runtimeOutput, true);

            } else {
                if (runtimeOutput.timeout) emitTimeout(runtimeOutput, 'execution');
                else emitWrong(runtimeOutput, 'Runtime');
            }

        } else {
            if (compileOutput.timeout) emitTimeout(compileOutput, 'compilation');
            else emitWrong(compileOutput, 'Compile');
        }

        // Now container that did not have problems
        // yield container.stopAsync();
        // yield container.removeAsync({f: true});
        yield reuseOrDisposeContainer(container, true);

    } catch (e) { // internal error
        //TODO: specify javaBox behavior for internal error
        console.log('500: Internal error with Docker!');
        emitServerError(e);
        yield container.killAsync({t: 0});
        yield container.removeAsync({v: true, force: true});
    }

});


const initializeContainer = coroutine(function*(junit, tarBuffer, messageId) {

    junit = junit || false;

    const createOpts = {Image: 'openjdk:8u121-jdk-alpine', Tty: true, Cmd: ['/bin/sh']};
    let container = Promise.promisifyAll(yield docker.createContainerAsync(createOpts));

    if(messageId === null || typeof messageId !== 'undefined')
        container['messageId'] = messageId;

    const startOps = {};
    yield container.startAsync(startOps);

    if(tarBuffer === null || typeof tarBuffer !== 'undefined'){
        const tarOptsSource = {path: 'home'};

        yield container.putArchiveAsync(tarBuffer, tarOptsSource);
    }

    if (junit) {
        yield container.putArchiveAsync('./archives/libs.tar', {path: '/'});
        yield container.putArchiveAsync('./archives/SecureTest.class.tar', {path: 'libs'});
        yield container.putArchiveAsync('./archives/TestRunner.class.tar', {path: 'libs'});
    }

    return container;
});

const getContainer = coroutine(function*(tarBuffer, messageId, junit) {

    junit = junit || false;

    let container;

    if(junit){

        console.log(jUnitContainers.length)

        container = jUnitContainers.pop();

    } else {

        console.log(javaContainers.length)

        container = javaContainers.pop();

    }

    if(typeof container == "undefined"){
        container = yield initializeContainer(junit, tarBuffer, messageId);
    } else {
        console.log("reusing")
        // Updates the container to handle the new task
        container['messageId'] = messageId;
        const tarOptsSource = {path: 'home'};
        yield container.putArchiveAsync(tarBuffer, tarOptsSource);
    }
    
    // const inspectOps = {};
    // let inspect = yield container.inspect(inspectOps);
    // console.log("Using container " + inspect.Id)

    return container;
});

const reuseOrDisposeContainer = coroutine(function*(container, junit) {

    junit = junit || false;

    let resolvedContainer;

    if((junit==true && jUnitContainers.length < maxContainers) || (junit==false && javaContainers.length < maxContainers)){

        yield container.stop();
        yield container.remove({v: true, force: true});

        let newContainer = yield initializeContainer(junit);
        resolvedContainer = yield Promise.resolve(newContainer);
        
        if(junit){

            jUnitContainers.push(resolvedContainer);

        } else {

            javaContainers.push(resolvedContainer);

        }

    } else {
        yield container.stop();
        yield container.remove({v: true, force: true});
    }


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

    let timeoutCallback = null;
    let timeoutHappend = false;
    const stdoutStream = new OutputStream();
    const stderrStream = new OutputStream();


    const execOpts = {Cmd: command, AttachStdout: true, AttachStderr: true, Tty: false};            // execution options
    const exec = Promise.promisifyAll(yield container.execAsync(execOpts));                         // create execution of command

    const stream = yield exec.startAsync();                                                         // start execution (get an output stream)
    container.modem.demuxStream(stream, stdoutStream, stderrStream);                                // intercept container output to our streams

    if (executionTimeLimit) {                                                                        // start keeping time
        timeoutCallback = setTimeout(() => {
            timeoutHappend = true
        }, executionTimeLimit);                // prepare timeout termination
    }


    let executionData = yield exec.inspectAsync();
    while (executionData.Running && timeoutHappend == false) {                                                                // loop (asynchronously) until execution stops
        executionData = yield exec.inspectAsync();
    }


    const executedSuccessfully = (executionData.ExitCode == 0 && timeoutHappend == false);                                    // set successful execution mark

    if (executionTimeLimit) clearTimeout(timeoutCallback);

    return {
        messageId: container.messageId,
        success: executedSuccessfully,
        output: stdoutStream.toString(),
        errorMessage: stderrStream.toString(),
        timeout: timeoutHappend
    }


});

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

function emitServerError(e) {
    throw e;
}

/**
 * Emit `result` event with success values.
 *
 * @param executionOutput {ExecutionOutput}: Output of a run command execution
 * @param junit {Boolean} [Optional][Default: false]: Set to true if execution output is from junit orchestrator class for parsing.
 */
function emitSuccess(executionOutput, junit) {
    junit = junit || false;
    const feedback = executionOutput;

    if (junit) {
        const parsed = parseOutput(feedback.output);
        feedback.output = parsed.normalOutput;
        feedback.totalNumberOfTests = parsed.totalNumberOfTests;
        feedback.numberOfTestsPassed = parsed.numberOfTestsPassed;
        feedback.testsOutput = parsed.testsOutput;
    }
    javaBox.emit('result', feedback);
}


const j = schedule.scheduleJob('*/60 * * * * *', function(){
  console.log('Cleaning old containers!');

  let container;

  while(jUnitContainers.length >= maxContainers) {
    container = jUnitContainers.pop();
    console.log("Removing container: " + container);
    container.stop();
    container.remove({v: true, force: true});
  }

  while(javaContainers.length >= maxContainers) {
    container = javaContainers.pop();
    console.log("Removing container: " + container);
    container.stop();
    container.remove({v: true, force: true});
  }

});

/**
 * Emit `result` event with timeout values and error message.
 *
 * @param feedback {Object}: The feedback with all the info to be emitted back.
 * @param stage {String}[Optional]: In which stage this function is called.
 */
function emitTimeout(feedback, stage) {//messageId, stdoutStream, stderrStream, stage) {


    feedback.errorMessage += '\n>>>JavaBox: Timeout reached';

    if (stage) {
        feedback.errorMessage += ` during ${stage}.`;
    } else {
        feedback.errorMessage += '.';
    }

    javaBox.emit('result', feedback);

}

/**
 * Emit `result` event with error values.
 *
 * @param executionOutput {ExecutionOutput}: Output of a run command execution.
 * @param stage {String}[Optional]: In which stage this function is called.
 */
function emitWrong(executionOutput, stage) {
    javaBox.emit('result', executionOutput);
}


/**
 * Initialising javaBox.
 */
javaBox.on('runJava', runJava);
javaBox.on('runJunit', runJunit);

module.exports = javaBox;