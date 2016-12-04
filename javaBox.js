const EventEmitter = require('events');
const Docker = require('dockerode');

// Docker connection
const docker = new Docker();

// Time to wait between checking that the command has been executed (milliseconds)
const EXEC_WAIT_TIME = 100;


// JavaBox eventEmitter
const javaBox = new EventEmitter();

javaBox.on('testDocker', testDocker);
javaBox.on('testJava', testJava);
javaBox.on('runJava', runJava);


// Outputs dockerFiles hello world directly to the socket
function testDocker(socket) {
    docker.run('hello-world', [], socket, function (err, data, container) {
        console.log(err, data, container);
    });
}

// Output java hello world directly to the socket
function testJava(socket) {

    let javacCmd = ['javac', 'home/Main.java'];
    let javaCmd = ['java', '-cp', 'home', 'Main'];
    let javaListener = (err, stream, container) => {
        /* for some strange reason
           stream.pipe(process.stdout);
           or even
           stream.on('data', ...)
           is missing the first letter, wtf!?
         */
        container.modem.demuxStream(stream, socket);
    };

    let souceLocation = './dockerFiles/testJava.tar';
    let execution = dockerCommand(javacCmd, null,
        dockerCommand(javaCmd, javaListener));

    createJContainer(souceLocation, execution);
};


// Run the Main.java inside the tar and outputs the result to the socket
function runJava(socket, tarPath) {
    let javacCmd = ['javac', 'home/Main.java'];
    let javaCmd = ['java', '-cp', 'home', 'Main'];
    let streamListener = (err, stream, container) => {
        /* for some strange reason
         stream.pipe(process.stdout);
         or even
         stream.on('data', ...)
         is missing the first letter, wtf!?
         */
        container.modem.demuxStream(stream, socket, socket);
    };

    let souceLocation = tarPath;
    let execution = dockerCommand(javacCmd, null,
        dockerCommand(javaCmd, streamListener));

    createJContainer(souceLocation, execution);
}


// Creates and start a container with bash, JDK SE and more
function createJContainer(javaSourceTar, callback) {

    let opts = {Image: 'openjdk', Tty: true, Cmd: ['/bin/bash']};
    docker.createContainer(opts, (err, container) => {

        let opts = {};
        container.start(opts, (err, data) => {

            let opts = {path: 'home'};
            container.putArchive(javaSourceTar, opts, (err, data) => {

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
function dockerCommand(command, streamListener, nexCommand) {

    let opts = {Cmd: command, AttachStdout: true, AttachStderr: true};

    let execution = (container) => {

        container.exec(opts, (err, exec) => {
            exec.start((err, stream) => {

                if (streamListener) streamListener(err, stream, container);
                if (nexCommand) waitCmdExit(container, exec, nexCommand);
            });
        });
    };

    return execution;
};

// Ensures that the exec process is terminated and fires the next command
function waitCmdExit(container, exec, nextCommand) {

    let checkExit = (err, data) => {

        // TODO: should be a switch statement (maybe)
        if (data.ExitCode === 0) {
            nextCommand(container);
        }
        else {
            waitCmdExit(container, exec, nextCommand);
        }
    };

    setTimeout(() => exec.inspect(checkExit), EXEC_WAIT_TIME);
};


module.exports = javaBox;
