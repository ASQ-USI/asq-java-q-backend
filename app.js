const tar = require('tar-stream');
const fs = require('fs');

const PORT = 5016;

// Two main eventEmitters of the application
const server = require('./server');
const javaBox = require('./javaBox');


server.on('runJunit', runJunit);
server.on('runJava', runJava);
javaBox.on('result', giveFeedBack);


function runJava(messageId, main, files, timeLimitCompile, timeLimitExecution) {

    let filesToAdd = files.length;

    const pack = tar.pack();

    const tryTarAndRun = () => {

        filesToAdd--;

        if (filesToAdd === 0) {
            const tarBuffer = pack.read();
            javaBox.emit('runJava', messageId, main, tarBuffer, timeLimitCompile, timeLimitExecution);
        }
    };

    files.forEach((file) => {
        pack.entry({ name: file.name }, file.data, tryTarAndRun);
    });
}

function runJunit(messageId, tests, files, timeLimitCompile, timeLimitExecution) {

    let filesToAdd = files.length + tests.length;

    const pack = tar.pack();

    const tryTarAndRun = () => {

        filesToAdd--;

        if (filesToAdd === 0) {
            const tarBuffer = pack.read();
            javaBox.emit('runJunit', messageId, tests, tarBuffer, timeLimitCompile, timeLimitExecution);
        }
    };

    files.forEach((file) => {
        pack.entry({ name: file.name }, file.data, tryTarAndRun);
    });

    tests.forEach((test) => {
        pack.entry({ name: test.name }, test.data, tryTarAndRun);
    });
}

function giveFeedBack(feedBack) {

    server.emit('result', feedBack);
}


server.listen(PORT);



