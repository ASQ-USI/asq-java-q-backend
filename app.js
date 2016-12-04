var tar = require('tar-fs');
var fs = require('fs');

const PORT = 5000;

// Two main eventEmitters of the application
const server = require('./server');
const javaBox = require('./javaBox');

// Test
server.on('testDocker', (socket) => {
    javaBox.emit('testDocker', socket);
}).on('testJava', (socket) => {
    javaBox.emit('testJava', socket);
}).on('runJava', runSingleClass);


function runSingleClass(socket, data) {

    console.log(data);

    let dirPath = './dockerFiles/singleClass';
    let tarPath = dirPath + '.tar';
    let filePath = dirPath + '/Main.java';

    fs.mkdir(dirPath, (err) => console.log('directory created'));
    fs.createWriteStream(filePath).write(data);

    tar.pack(dirPath).pipe(fs.createWriteStream(tarPath));

    javaBox.emit('runJava', socket, tarPath);
}

server.listen(PORT);



