const tar = require('tar-fs');
const fs = require('fs');

const PORT = 5016;

// Two main eventEmitters of the application
const server = require('./server');
const javaBox = require('./javaBox');


server.on('runJava', runSingleClass);
javaBox.on('result', giveFeedBack);


function runSingleClass(clientId, main, files, timeLimitCompile, timeLimitExecution) {


    const dirPath = `./dockerFiles/${clientId}`;
    const tarPath = `${dirPath}.tar`;

    const makeTarAndRun = () => {

        tar.pack(dirPath).pipe(fs.createWriteStream(tarPath));
        javaBox.emit('runJava', clientId, main, tarPath, timeLimitCompile, timeLimitExecution);
    };

    const writeFiles = () => {

        fs.readdir(dirPath, (err, oldFiles) => {

            let filesToDelete = oldFiles.length;
            let filesToAdd = files.length;

            const newFilesNames = [];

            const tryTarAndRun = () => {

                if ((filesToDelete === 0) && (filesToAdd === 0)) {
                    makeTarAndRun();
                }
            };

            const fileAdded = () => {

                filesToAdd--;
                tryTarAndRun();
            };

            const fileDeleted = () => {

                filesToDelete--;
                tryTarAndRun();
            };

            files.forEach((file) => {

                const filePath = `${dirPath}/${file.name}`;
                newFilesNames.push(file.name);

                fs.createWriteStream(filePath).write(file.data, fileAdded);
            });

            oldFiles.forEach((oldFile) => {

                if (newFilesNames.includes(oldFile)) {
                    fileDeleted();
                }
                else {
                    fs.unlink(`${dirPath}/${oldFile}`, fileDeleted);
                }
            });
        });
    };

    const manageClientDir = () => {

        fs.access(dirPath, (err) => {

            if (err) {
                fs.mkdir(dirPath, writeFiles);
            } else {
                writeFiles();
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

    server.emit('result', feedBack);
};


server.listen(PORT);



