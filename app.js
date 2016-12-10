const tar = require('tar-fs');
const fs = require('fs');

const PORT = 5000;

// Two main eventEmitters of the application
const server = require('./server');
const javaBox = require('./javaBox');


server.on('runJava', runSingleClass);
javaBox.on('result', giveFeedBack);


function runSingleClass(clientId, fileName, code) {

    const dirPath = `./dockerFiles/${clientId}`;
    const tarPath = `${dirPath}.tar`;
    const filePath = `${dirPath}/${fileName}`;

    const writeFile = () => {

        fs.createWriteStream(filePath).write(code);

        tar.pack(dirPath).pipe(fs.createWriteStream(tarPath));

        javaBox.emit('runJava', clientId, fileName, tarPath);
    };

    const manageClientDir = () => {

        fs.access(dirPath, (err) => {

            if (err) {
                fs.mkdir(dirPath, writeFile);
            } else {
                emptyDirectory(dirPath, writeFile, fileName);
            };
        });
    };

    const manageDockerDir = () => {

        fs.access('./dockerFiles/', (err) => {

            if (err) {
                fs.mkdir('./dockerFiles/', manageClientDir);
            } else {
                manageClientDir();
            };
        });
    };

    manageDockerDir();
}

function giveFeedBack(feedBack) {
    feedBack['timeOut'] = false;
    server.emit('result', feedBack);
};


function emptyDirectory(dirPath, callback, exceptionFile) {

    fs.readdir(dirPath, (err, files) => {

        let filesToDelete = files.length;
        if (filesToDelete === 0) {
            callback();
        }

        const tryCallback = (callback) => {

            filesToDelete--;

            if (filesToDelete === 0) {
                callback();
            }
        };

        files.forEach((file) => {

            if (file === exceptionFile) {
                tryCallback(callback);
            }
            else {
                fs.unlink(`${dirPath}/${file}`, tryCallback(callback));
            }
        });
    });
};

server.listen(PORT);



