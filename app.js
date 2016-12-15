const tar = require('tar-stream');
const fs = require('fs');

const PORT = 5016;

// Two main eventEmitters of the application
const server = require('./server');
const javaBox = require('./javaBox');


server.on('runJunit', runJunit_2);
server.on('runJava', runJava_2);
javaBox.on('result', giveFeedBack);


function runJava_2(clientId, main, files, timeLimitCompile, timeLimitExecution) {

    let filesToAdd = files.length;

    const pack = tar.pack();

    const tryTarAndRun = () => {

        filesToAdd--;

        if (filesToAdd === 0) {
            const tarBuffer = pack.read();
            javaBox.emit('runJava', clientId, main, tarBuffer, timeLimitCompile, timeLimitExecution);
        }
    };

    files.forEach((file) => {
        pack.entry({ name: file.name }, file.data, tryTarAndRun);
    });
}

function runJunit_2(clientId, tests, files, timeLimitCompile, timeLimitExecution) {

    let filesToAdd = files.length + tests.length;

    const pack = tar.pack();

    const tryTarAndRun = () => {

        filesToAdd--;

        if (filesToAdd === 0) {
            const tarBuffer = pack.read();
            javaBox.emit('runJunit', clientId, tests, tarBuffer, timeLimitCompile, timeLimitExecution);
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



