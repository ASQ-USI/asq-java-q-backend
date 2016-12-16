const net = require('net');
const JsonSocket = require('json-socket');

const port = 5016;
const host = '127.0.0.1';

const simpleSubmission = {
    main: 'HelloWorld.java',
    files: [{
        name: 'HelloWorld.java',
        data: `public class HelloWorld
            {
            public static void main(String[] args) {
            // Prints "Hello, World" to the terminal window.
            System.out.println("Hello, World");
            }
            }`
    }]
};
const junitSubmission = {
    files: [{
        name: 'MessageUtil.java',
        data: `public class MessageUtil {

   private String message;

   //Constructor
   //@param message to be printed
   public MessageUtil(String message){
      this.message = message;
   }
      
   // prints the message
   public String printMessage(){
      System.out.println(message);
      return message;
   }


	
}`
    }],
    tests: [{
        name: 'TestJunit.java',
        data: `import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class TestJunit {
	
   String message = "Hello World";	
   MessageUtil messageUtil = new MessageUtil(message);

   @Test
   public void testPrintMessage() {
      assertEquals(message,messageUtil.printMessage());
   }
}`
    }, {
        name: 'TestJunit2.java',
        data: `import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class TestJunit2 {
	
   String message = "Hello World";	
   MessageUtil messageUtil = new MessageUtil(message);

   @Test
   public void testPrintMessage() {
      assertEquals(message,messageUtil.printMessage());
   }

   @Test
   public void foo(){
   	assertEquals(1,1);
   }
}`
    }, {
        name: 'TestJunit3.java',
        data: `import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class TestJunit3 {
	
   String message = "Hello World";	
   MessageUtil messageUtil = new MessageUtil(message);

   @Test
   public void testPrintMessage() {
      assertEquals(1,2);
   }
}`
    }]
};

const clientsNumber = parseInt(process.argv[2]) || 1; // reading the command line argument
let clientsLeft = clientsNumber;

function makeConnection(clientId) {

    const socket = new JsonSocket(new net.Socket());
    socket.connect(port, host);

    socket.on('connect', function() {

        const message = {
            clientId : clientId,
            submission : junitSubmission,
            compileTimeoutMs : 600000,
            executionTimeoutMs : 600000,
            charactersMaxLength: 10000

        };

        console.time(clientId);

        socket.sendMessage(message);

        socket.on('message', function(message) {

            clientsLeft--;

            console.log(message);
            console.log(message.output);
            console.log(message.errorMessage);
            console.timeEnd(clientId);
            console.log(`Clients left: ${clientsLeft}\n \n`);
        });
    });
};

for (var i = 0; i < clientsNumber; i++) {
    const clientId = 'client' + i;
    makeConnection(clientId);
};
