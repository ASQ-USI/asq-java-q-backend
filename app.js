var tar = require('tar-fs');
var fs = require('fs');

const PORT = 5000;

// Two main eventEmitters of the application
const server = require('./server');
const javaBox = require('./javaBox');

// Test
server.on('runJava', runSingleClass);
javaBox.on('result', giveFeedBack);


function runSingleClass(clientId, code) {

    console.log('Ok some code:');
    console.log(clientId, code);

    let dirPath = './dockerFiles/' + clientId;
    let tarPath = dirPath + '.tar';
    let filePath = dirPath + '/Main.java';

    if (!fs.existsSync('./dockerFiles')) fs.mkdir('./dockerFiles/');
    if (!fs.existsSync(dirPath)) fs.mkdir(dirPath);
    fs.createWriteStream(filePath).write(code);

    tar.pack(dirPath).pipe(fs.createWriteStream(tarPath));

    javaBox.emit('runJava', clientId, tarPath);
    console.log('instructions passed to javaBox');
}

function giveFeedBack(feedBack) {
    server.emit('result', feedBack);
};

server.listen(PORT);



