const tar = require('tar-stream');
const fs = require('fs');

const PORT = 5016;

// Two main eventEmitters of the application
const server = require('./server');
const javaBox = require('./javaBox');


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

function giveFeedBack(feedBack) {

    server.emit('result', feedBack);
}


server.listen(PORT);



