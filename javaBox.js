const EventEmitter = require('events');
const Docker = require('dockerode');

// Docker connection
const docker = new Docker();

// Time to wait between checking that the command has been executed (milliseconds)
const EXEC_WAIT_TIME = 100;


// JavaBox eventEmitter
const javaBox = new EventEmitter();

javaBox.on('runJava', runJava);


// Run the Main.java inside the tar and outputs the result to the socket
function runJava(clientId, tarPath) {
    let javacCmd = ['javac', 'home/Main.java'];
    let javaCmd = ['java', '-cp', 'home', 'Main'];

    let souceLocation = tarPath;
    let execution = dockerCommand(javacCmd, dockerCommand(javaCmd));

    createJContainer(clientId, souceLocation, execution);
}


// Creates and start a container with bash, JDK SE and more
function createJContainer(clientId, javaSourceTar, callback) {

    let opts = {Image: 'openjdk', Tty: true, Cmd: ['/bin/bash']};
    docker.createContainer(opts, (err, container) => {

        container['clientId'] = clientId;

        let opts = {};
        container.start(opts, (err, data) => {

            let opts = {path: 'home'};
            container.putArchive(javaSourceTar, opts, (err, data) => {

                console.log('container created');
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
function dockerCommand(command, nexCommand) {

    let opts = {Cmd: command, AttachStdout: true, AttachStderr: true};

    let execution = (container) => {

        container.exec(opts, (err, exec) => {
            console.log('executing ', command);
            exec.start((err, stream) => waitCmdExit(container, exec, nexCommand, stream));
        });
    };

    return execution;
};

// Ensures that the exec process is terminated and fires the next command
function waitCmdExit(container, exec, nextCommand, stream) {

    console.log('waiting for command to finish');

    let checkExit = (err, data) => {

        if (data.Running) { // command is still running, check later
            waitCmdExit(container, exec, nextCommand, stream);
        }
        else if ((data.ExitCode === 0) && (nextCommand)) { // command successful, has next command
            nextCommand(container);
        }
        else if (data.ExitCode === 0) { // command successful, it was the last command

            let feedBack = {
                clientId: container.clientId,
                passed: true,
                output: stream.read().toString().replace(/\u0000|\u0001/g, '').trim(),
                errorMessage: '',
            };
            javaBox.emit('result', feedBack);
        }
        else { // command failed

            let feedBack = {
                clientId: container.clientId,
                passed: false,
                output: '',
                errorMessage: stream.read().toString().replace(/\u0000|\u0001/g, '').trim(),
            };
            javaBox.emit('result', feedBack);
        }
    };

    setTimeout(() => exec.inspect(checkExit), EXEC_WAIT_TIME);
};


module.exports = javaBox;
