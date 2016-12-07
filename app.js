var tar = require('tar-fs');
var fs = require('fs');

const PORT = 5000;

// Two main eventEmitters of the application
const server = require('./server');
const javaBox = require('./javaBox');

// Test
server.on('runJava', runSingleClass);
javaBox.on('result', giveFeedBack);


function runSingleClass(clientId, fileName, code) {

    console.log('Ok some code:');
    console.log(clientId, code);

    let dirPath = './dockerFiles/' + clientId;
    let tarPath = dirPath + '.tar';
    let filePath = dirPath + '/' + fileName + '.java';

    let createDocketFiles = () => {
        if (!fs.existsSync('./dockerFiles')) fs.mkdir('./dockerFiles/', createDirPath);
        else createDirPath();
    };
    let createDirPath = () => {
        if (!fs.existsSync(dirPath)) fs.mkdir(dirPath, writeFile);
        else writeFile();
    };
    let writeFile = () => {
        fs.createWriteStream(filePath).write(code, makeTarAndRun);
    };
    let makeTarAndRun = () => {
        tar.pack(dirPath).pipe(fs.createWriteStream(tarPath));

        javaBox.emit('runJava', clientId, fileName, tarPath);
        console.log('instructions passed to javaBox');
    };

    createDocketFiles();
}

function giveFeedBack(feedBack) {
    feedBack['timeOut'] = false;
    server.emit('result', feedBack);
};

server.listen(PORT);



