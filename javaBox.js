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

    const javacCmd = ['javac', '-cp', 'home', `home/${main}`];
    const javaCmd = ['java', '-cp', 'home', className];

    const sourceLocation = tarPath;
    const execution = dockerCommand(javacCmd, timeLimitCompile, dockerCommand(javaCmd, timeLimitExecution));

    createJContainer(clientId, sourceLocation, execution);
};


// Creates and start a container with bash, JDK SE and more
function createJContainer(clientId, javaSourceTar, callback) {

    const createOpts = {Image: 'openjdk', Tty: true, Cmd: ['/bin/bash']};
    docker.createContainer(createOpts, (err, container) => {

        if (err) {console.log("Error creating container!"); return;}

        container['clientId'] = clientId;

        const startOpts = {};
        container.start(startOpts, (err, data) => {

            const tarOpts = {path: 'home'};
            container.putArchive(javaSourceTar, tarOpts, (err, data) => {

                callback(container);
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

    const execution = (container) => {

        container.exec(opts, (err, exec) => {
            exec.start((err, stream) => waitCmdExit(container, exec, nextCommand, stream, commandTimeLimit));
        });
    };

    return execution;
};

// Ensures that the exec process is terminated and fires the next command
function waitCmdExit(container, exec, nextCommand, stream, commandTimeOut, previousTime){

    let timeSpent = previousTime || 0;

    const checkExit = (err, data) => {

        if (data.Running) { // command is still running, check later or send time out

            timeSpent += EXEC_WAIT_TIME_MS;                             // count time spent

            if (timeSpent >= commandTimeOut){                           // time period expired

                const feedback = {
                    clientId: container.clientId,
                    passed: false,
                    output: '',
                    errorMessage: "",
                    timeOut: true
                };

                javaBox.emit('result', feedback);

                container.kill({}, () => {});               // process is still running though, but it shouldn't matter
                container.remove({v: true}, () => {});


            }else {
                waitCmdExit(container, exec, nextCommand, stream, commandTimeOut, timeSpent);
            }
        }
        else if ((data.ExitCode === 0) && (nextCommand)) { // command successful, has next command
            nextCommand(container);
        }
        else if (data.ExitCode === 0) { // command successful, it was the last command

            const feedback = {
                clientId: container.clientId,
                passed: true,
                output: stream.read().toString(),
                //output: stream.read().toString().replace(/\u0000|\u0001/g, '').trim(),
                errorMessage: '',
                timeOut: false

            };

            javaBox.emit('result', feedback);

            container.kill({}, () => {});
            container.remove({v: true}, () => {});
        }
        else { // command failed

            const feedback = {
                clientId: container.clientId,
                passed: false,
                output: '',
                errorMessage: stream.read().toString(),
                //errorMessage: stream.read().toString().replace(/\u0000|\u0001/g, '').trim(),
                timeOut: false

            };

            javaBox.emit('result', feedback);

            container.kill({}, () => {});
            container.remove({v: true}, () => {});
        }
    };

    setTimeout(() => exec.inspect(checkExit), EXEC_WAIT_TIME_MS);
}

function sendResponse() {

    const feedback = {
        clientId: container.clientId,
        passed: false,
        output: '',
        errorMessage: stream.read().toString(),
        //errorMessage: stream.read().toString().replace(/\u0000|\u0001/g, '').trim(),
    };
    javaBox.emit('result', feedback);
}


module.exports = javaBox;
