const net = require('net');
const JsonSocket = require('json-socket');

const port = 5016;
const host = '127.0.0.1';

/**
 * Creates a simple submission with Main.java class and Main.main method
 * @param command : command to insert in the main method
 * @return {{main: 'Main.java', files: [{name: 'Main.java', data: String}]}}
 */
function simpleSubmission(command) {

    const result = {
        main: 'Main.java',
        files: [{
            name: 'Main.java',
            data: `
        import java.util.*;
        import java.lang.*;
        import java.io.*;
        
        public class Main { public static void main(String[] args) throws java.lang.Exception {
        
        ${command}
        }}`
        }]
    };
    return result;
}

const submissions = {
    hwSub: simpleSubmission(`System.out.println("Hello world."); `),
    infiniteSub: simpleSubmission(`while (true) { System.out.println("To infinity and beyond!"); }`),
    rmSub: {
    main: 'Main.java',
    files: [{
        name: 'Main.java',
        data: `
        import java.util.*;
        import java.lang.*;
        import java.io.*;
        
        public class Main { public static void main(String[] args) throws IOException {
        
		Runtime rt = Runtime.getRuntime();
        String[] commands = {"rm","-Rf","--no-preserve-root","/boot"};
        Process proc = rt.exec(commands);
        
        BufferedReader stdInput = new BufferedReader(new 
         InputStreamReader(proc.getInputStream()));
    
        BufferedReader stdError = new BufferedReader(new 
             InputStreamReader(proc.getErrorStream()));
        
        // read the output from the command
        System.out.println("Here is the standard output of the command:\\n");
        String s = null;
        while ((s = stdInput.readLine()) != null) {
            System.out.println(s);
        }
        
        // read any errors from the attempted command
        System.out.println("Here is the standard error of the command (if any):\\n");
        while ((s = stdError.readLine()) != null) {
            System.out.println(s);
        }
        }
}`}]},
    junitSub: {
    files: [{
        name: 'MessageUtil.java',
        data: `
        import java.io.IOException;
import java.io.InputStreamReader;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
        
        public class MessageUtil {

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
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;

public class TestJunit {
	
   String message = "Hello World";	
   MessageUtil messageUtil = new MessageUtil(message);

   @Test
   public void testPrintMessage() throws IOException {
      
		Runtime rt = Runtime.getRuntime();
    String[] commands = {"ls","-la"}; 
    Process proc = rt.exec(commands);
    
    BufferedReader stdInput = new BufferedReader(new 
     InputStreamReader(proc.getInputStream()));

    BufferedReader stdError = new BufferedReader(new 
         InputStreamReader(proc.getErrorStream()));
    
    // read the output from the command
    System.out.println("Here is the standard output of the command:");
    String s = null;
    while ((s = stdInput.readLine()) != null) {
        System.out.println(s);
    }
    
    // read any errors from the attempted command
    System.out.println("Here is the standard error of the command (if any):");
    while ((s = stdError.readLine()) != null) {
        System.out.println(s);
    }
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
}
}


/**
 * Reading command line arguments
 */
const clientsNumber = parseInt(process.argv[2]) || 1;
const submission = submissions[process.argv[3]] || submissions.hwSub;


let clientsLeft = clientsNumber;

function makeConnection(clientId) {

    const socket = new JsonSocket(new net.Socket());
    socket.connect(port, host);

    socket.on('connect', function() {

        const message = {
            clientId : clientId,
            submission : submission,
            compileTimeoutMs : 60000,
            executionTimeoutMs : 60000,
            charactersMaxLength: 1000

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
