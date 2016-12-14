const EventEmitter = require('events');
const Docker = require('dockerode');

// Docker connection
const docker = new Docker();

// Time to wait between checking that the command has been executed (milliseconds)
const EXEC_WAIT_TIME_MS = 250;


// JavaBox eventEmitter
const javaBox = new EventEmitter();

let _junit_ = false;

javaBox.on('runJava', runJava);
javaBox.on('runJunit', runJunit);



// Run the Main.java inside the tar and outputs the result to the socket
function runJava(clientId, main, tarPath, timeLimitCompile, timeLimitExecution) {
    _junit_ = false;

    const className = main.split('.')[0];

    const javacCmd = ['javac', `home/${main}`];
    const javaCmd = ['java', className];

    const sourceLocation = tarPath;
    const execution = dockerCommand(javacCmd, timeLimitCompile, dockerCommand(javaCmd, timeLimitExecution));

    createJContainer(clientId, sourceLocation, execution);
};


// Creates and starts a container with bash, JDK SE and more
function createJContainer(clientId, javaSourceTar, callback) {

    const createOpts = {Image: 'openjdk:8u111-jdk', Tty: true, Cmd: ['/bin/bash']};
    docker.createContainer(createOpts, (err, container) => {

        if (err) {callback(err, container); return}

        container['clientId'] = clientId;

        const startOpts = {};
        container.start(startOpts, (err, data) => {

            if (err) {callback(err, data); return};

            const tarOpts = {path: 'home'};
            container.putArchive(javaSourceTar, tarOpts, (err, data) => {

                if (err) {callback(err, data); return};
   
                if (_junit_ == true){

                    const tarOpts = {path: 'home'};
                    container.putArchive('./archives/libs.tar', tarOpts, (err, data) => {

                        if (err) {
                            callback(err, data);
                        } else {
                            callback(null, container)
                        }
                    });

                    container.putArchive('./archives/TestRunner.java.tar', tarOpts, (err, data)=>{

                        if (err) {
                            callback(err, data);
                        } else {
                            callback(null, container)
                        }
                    });

                }
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
            exec.start((err, stream) => waitCmdExit(container, exec, nextCommand, stream, commandTimeLimit));
        });
    };

    return execution;
};

// Ensures that the exec process is terminated and fires the next command
function waitCmdExit(container, exec, nextCommand, stream, commandTimeOut, previousTime){

    let timeSpent = previousTime || 0;

    const checkExit = (err, data) => {

        if (data.Running) { // command is still running, check lateror send time out

            timeSpent += EXEC_WAIT_TIME_MS;                             // count time spent

            if (timeSpent >= commandTimeOut){                           // time period expired

                const feedback = {
                    clientId: container.clientId,
                    passed: false,
                    output: '',
                    errorMessage: "Reached maximum time limit",
                    timeOut: true
                };

                javaBox.emit('result', feedback);

                container.kill({}, () =>
                    container.remove({v: true}, () => {}));


            } else {

            waitCmdExit(container, exec, nextCommand, stream, commandTimeOut, timeSpent);

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

            const output = stream.read();
            const outputStream = (output) ? output.toString() : '';

            const feedback = {
                clientId: container.clientId,
                passed: false,
                errorMessage: '',
                timeOut: false

            };

            if (_junit_ == true){

                const parsed = parseOutput(outputStream);
                feedback.output = parsed.output;
                feedback.totalNumberOfTests = parsed.totalNumberOfTests;
                feedback.numberOfTestsPassed = parsed.numberOfTestsPassed;
                feedback.testsOutput = parsed.testsOutput;

            }else{
                feedback.output = outputStream;
            }

            javaBox.emit('result', feedback);

            container.kill({}, () =>
                container.remove({v: true}, () => {}));

        } else { // command failed

            const error = stream.read();
            const errorString = (error) ? error.toString() : '';

            const feedback = {
                clientId: container.clientId,
                passed: false,
                output: '',
                errorMessage: errorString,
                timeOut: false

            };

            javaBox.emit('result', feedback);

            container.kill({}, () =>
                container.remove({v: true}, () => {}));
        }
    };

    setTimeout(() => exec.inspect(checkExit), EXEC_WAIT_TIME_MS);
};

function runJunit(clientId, junitFileNames, tarPath, timeLimitCompile, timeLimitExecution) {

    _junit_ = true;

    let junitFiles = [];
    junitFileNames.forEach((f)=>{
        junitFiles.push( f.split('.')[0]);
    })

    const className = 'TestRunner';

    const javacCmd = ['javac', '-cp', 'home:home/libs', '*.java'];
    let javaCmd = ['java', '-cp', 'home:home/libs', className];

    junitFiles.forEach((file)=>{
        javaCmd.push(file);
    })

    const sourceLocation = tarPath;
    const execution = dockerCommand(javacCmd, timeLimitCompile, dockerCommand(javaCmd, timeLimitExecution));

    createJContainer(clientId, sourceLocation, execution);
};

function parseOutput(input){
    const _INPUT_DELIMITER_ = '_!*^&_test-output';

    let wholeOutput = {};

    wholeOutput.normalOutput = input.split(_INPUT_DELIMITER_)[0];
    
    const testOutput = JSON.parse(input.split(_INPUT_DELIMITER_)[1]);
    
    if (testOutput.totalNumberOfTests)  wholeOutput.totalNumberOfTests  = testOutput.totalNumberOfTests;
    if (testOutput.numberOfTestsPassed) wholeOutput.numberOfTestsPassed = testOutput.numberOfTestsPassed;
    if (testOutput.testsOutput)         wholeOutput.testsOutput         = testOutput.testsOutput;

    return wholeOutput;
}


}
module.exports = javaBox;
