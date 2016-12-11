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
function runJava(clientId, main, tarPath) {

    const className = main.split('.')[0];

    const javacCmd = ['javac', '-cp', 'home', `home/${main}`];
    const javaCmd = ['java', '-cp', 'home', className];

    const souceLocation = tarPath;
    const execution = dockerCommand(javacCmd, dockerCommand(javaCmd));

    createJContainer(clientId, souceLocation, execution);
};


// Creates and starts a container with bash, JDK SE and more
function createJContainer(clientId, javaSourceTar, callback) {

    const createOpts = {Image: 'openjdk:8u111-jdk', Tty: true, Cmd: ['/bin/bash']};
    docker.createContainer(createOpts, (err, container) => {

        if (err) {callback(err, container); return}

        container['clientId'] = clientId;

        const startOpts = {};
        container.start(startOpts, (err, data) => {

            if (err) {callback(err, data); return}

            const tarOpts = {path: 'home'};
            container.putArchive(javaSourceTar, tarOpts, (err, data) => {

                if (err) {
                    callback(err, data);
                } else {
                    callback(null, container)
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
function dockerCommand(command, nexCommand) {

    const opts = {Cmd: command, AttachStdout: true, AttachStderr: true};

    const execution = (err, container) => {

        if (!err) container.exec(opts, (err, exec) => {
            exec.start((err, stream) => waitCmdExit(container, exec, nexCommand, stream));
        });
    };

    return execution;
};

// Ensures that the exec process is terminated and fires the next command
function waitCmdExit(container, exec, nextCommand, stream) {

    const checkExit = (err, data) => {

        if (data.Running) { // command is still running, check later
            waitCmdExit(container, exec, nextCommand, stream);
        }
        else if ((data.ExitCode === 0) && (nextCommand)) { // command successful, has next command
            nextCommand(null, container);
        }
        else if (data.ExitCode === 0) { // command successful, it was the last command

            const feedback = {
                clientId: container.clientId,
                passed: true,
                output: stream.read().toString(),
                errorMessage: ''
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
                errorMessage: stream.read().toString()
            };

            javaBox.emit('result', feedback);

            container.kill({}, () => {});
            container.remove({v: true}, () => {});
        }
    };

    setTimeout(() => exec.inspect(checkExit), EXEC_WAIT_TIME_MS);
};


module.exports = javaBox;
