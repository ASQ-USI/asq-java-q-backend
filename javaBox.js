const EventEmitter = require('events');
const Docker = require('dockerode');

// Docker connection
const docker = new Docker();

// Time to wait between checking that the command has been executed (milliseconds)
const EXEC_WAIT_TIME_MS = 250;


// JavaBox eventEmitter
const javaBox = new EventEmitter();

javaBox.on('runJava', runJava);


// Run the Main.java inside the tar and outputs the result to the socket
function runJava(clientId, main, tarPath, timeLimitCompile, timeLimitExecution) {

    const className = main.split('.')[0];

    const javacCmd = ['javac', '-cp', 'home:junit/junit-4.12:junit/hamcrest-core-1.3', `home/${main}`];
    const javaCmd = ['java', '-cp', 'home:junit/junit-4.12:junit/hamcrest-core-1.3', className];

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

                const tarOpts = {path: '/'};
                container.putArchive('./junit/junit.tar', tarOpts, (err, data) => {

                    if (err) {
                        callback(err, data);
                    } else {
                        callback(null, container)
                    }
                });
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

        } else if (data.ExitCode === 0) { // command successful, it was the last command

            const feedback = {
                clientId: container.clientId,
                passed: true,
                output: stream.read().toString(),
                errorMessage: '',
                timeOut: false

            };

            javaBox.emit('result', feedback);

            container.kill({}, () =>
                container.remove({v: true}, () => {}));

        } else { // command failed

            const feedback = {
                clientId: container.clientId,
                passed: false,
                output: '',
                errorMessage: stream.read().toString(),
                timeOut: false

            };

            javaBox.emit('result', feedback);

            container.kill({}, () =>
                container.remove({v: true}, () => {}));
        }
    };

    setTimeout(() => exec.inspect(checkExit), EXEC_WAIT_TIME_MS);
};


module.exports = javaBox;
