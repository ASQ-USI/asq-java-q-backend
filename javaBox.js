const EventEmitter = require('events');
const Docker = require('dockerode');
const concat = require('concat-stream');

// Docker connection
const docker = new Docker();

// Time to wait between checking that the command has been executed (milliseconds)
const EXEC_WAIT_TIME_MS = 250;


// JavaBox eventEmitter
const javaBox = new EventEmitter();

javaBox.on('runJava', runJava);
javaBox.on('runJunit', runJunit);


// Run the Main.java inside the tar and outputs the result to the socket
function runJava(clientId, main, tarPath, timeLimitCompile, timeLimitExecution) {

    const className = main.split('.')[0];

    const javacCmd = ['javac', '-cp', 'home:junit/junit-4.12:junit/hamcrest-core-1.3', 'home/' + main];
    const javaCmd = ['java', '-cp', 'home:junit/junit-4.12:junit/hamcrest-core-1.3', className];

    const sourceLocation = tarPath;
    const execution = dockerCommand(javacCmd, timeLimitCompile, dockerCommand(javaCmd, timeLimitExecution));

    createJContainer(clientId, sourceLocation, false, execution);
};

function runJunit(clientId, junitFileNames, tarPath, timeLimitCompile, timeLimitExecution) {

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
    javacCmd.push('home/' + className + '.java');


    const sourceLocation = tarPath;
    const execution = dockerCommand(javacCmd, timeLimitCompile, dockerCommand(javaCmd, timeLimitExecution));

    createJContainer(clientId, sourceLocation, true, execution);
};


// Creates and starts a container with bash, JDK SE and more
function createJContainer(clientId, javaSourceTar, isJunit, callback) {

    let copyToCall = 3;

    const tryCallback = (container) => {

        if (copyToCall === 0) {

            callback(null, container);
        }
    };

    const createOpts = {Image: 'openjdk:8u111-jdk', Tty: true, Cmd: ['/bin/bash']};
    docker.createContainer(createOpts, (err, container) => {

        if (err) {callback(err, container); return}

        container['clientId'] = clientId;

        const startOpts = {};
        container.start(startOpts, (err, data) => {

            if (err) {callback(err, data); return};

            if (isJunit) {

                const tarOptsRunner = {path: 'home'};
                container.putArchive('./archives/TestRunner.java.tar', tarOptsRunner, (err, data) => {
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
            container.putArchive(javaSourceTar, tarOptsSource, (err, data) => {
                copyToCall--;
                if (err) callback(err, data);
                else tryCallback(container);
            });
        });
    });
};

/*
 * Returns a function that on some given container,
 * executes a specific command, attaches the specific output listener and
 * after the command is executed pipelines the next one
 */
function dockerCommand(command, commandTimeLimit, nextCommand) {

    const opts = {Cmd: command, AttachStdout: true, AttachStderr: true};

    const execution = (err, container) => {

        if (!err) container.exec(opts, (err, exec) => {
            exec.start((err, stream) => {

                let stdOut = '';
                let stdErr = '';
                const stdOutStream = concat({}, (data) => {
                    stdOut += data;
                });
                const stdErrStream = concat({}, (data) => {
                    stdErr += data;
                });

                container.modem.demuxStream(stream, stdOutStream, stdErrStream);


                const streamManager = {

                    readOut: () => {return stdOut},
                    readErr: () => {return stdErr},
                    endStream: () => {
                        stdOutStream.end();
                        stdErrStream.end();
                    }
                };

                waitCmdExit(container, exec, nextCommand, streamManager, commandTimeLimit);
            });
        });
    };

    return execution;
};

// Ensures that the exec process is terminated and fires the next command
function waitCmdExit(container, exec, nextCommand, streamManager, commandTimeOut, previousTime){

    let timeSpent = previousTime || 0;

    const checkExit = (err, data) => {

        if (data.Running) { // command is still running, check later or send time out

            timeSpent += EXEC_WAIT_TIME_MS;                             // count time spent

            if (timeSpent >= commandTimeOut){                           // time period expired

                feedbackAndClose(container, streamManager, false, true);

            } else {

            waitCmdExit(container, exec, nextCommand, streamManager, commandTimeOut, timeSpent);

            }

        } else if ((data.ExitCode === 0) && (nextCommand)) { // command successful, has next command

            nextCommand(null, container);



        /* * * *
        * if test files exist (and passed is true):
        *
        * output: {
        *
        *   clientId,
        *   passed: Boolean (false if compile/runtime errors true otherwise),
        *   output: String,
        *   errorMessage: String (empty if `passed` is true),
        *   timeOut: Boolean,
        *   totalNumberOfTests: Integer,
        *   numberOfTestsPassed: Integer,
        *   testsOutput: String (output of all failed tests)
        * }
        *
        * otherwise:
        *
        * output: {
        *
        *   clientId,
        *   passed: Boolean (false if compile/runtime errors true otherwise),
        *   output: String,
        *   errorMessage: String (empty if `passed` is false),
        *   timeOut: Boolean
        * * * */

        } else if (data.ExitCode === 0) { // command successful, it was the last command

            feedbackAndClose(container, streamManager, true, false)

        } else { // command failed

            feedbackAndClose(container, streamManager, false, false);
        }
    };

    setTimeout(() => exec.inspect(checkExit), EXEC_WAIT_TIME_MS);
};


// Sends back the feedback and closes the container
function feedbackAndClose(container, streamManager, compile, timeOut) {

    streamManager.endStream();

    const feedback = {
        clientId: container.clientId,
        compile: compile,
        output: (!timeOut) ? streamManager.readOut() : '',
        errorMessage: (!timeOut) ? streamManager.readErr() : "Reached maximum time limit",
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

function parseOutput(input){

    const _INPUT_DELIMITER_ = '_!*^&_test-output';

    const wholeOutput = {};

    wholeOutput.normalOutput = input.split(_INPUT_DELIMITER_)[0];

    let testOutput = null;

    try {
         testOutput = JSON.parse(input.split(_INPUT_DELIMITER_)[1]);

    } catch(err) {
        console.log('no junit');
    }

    if (testOutput){
        wholeOutput.totalNumberOfTests  = testOutput.totalNumberOfTests;
        wholeOutput.numberOfTestsPassed = testOutput.numberOfTestsPassed;
        wholeOutput.testsOutput         = testOutput.testsOutput;
    }

    return wholeOutput;
}


module.exports = javaBox;
