const net = require('net');
const JsonSocket = require('json-socket');

const port = 5016;
const host = '127.0.0.1';

const clientsNumber = parseInt(process.argv[2]) || 1; // reading the command line argument
let clientsLeft = clientsNumber;

function makeConnection(clientId) {

    const socket = new JsonSocket(new net.Socket());
    socket.connect(port, host);

    socket.on('connect', function() {

        const message = {
            clientId : clientId,
            submission : {main: 'AllTests.java', files: [
                {
                    name: 'HelloWorld.java',
                    data: `public class HelloWorld
{

   private String name = "";

   public String getName()
   {
      return name;
   }

   public String getMessage()
   {
      if (name == "")
      {
         return "Hello!";
      }
      else
      {
         return "Hello " + name + "!";
      }
   }

   public void setName(String name)
   {
      this.name = name;
   }

}`
                },
                {
                    name: 'TestHelloWorld.java',
                    data: `import static org.junit.Assert.*;

import org.junit.Before;
import org.junit.Test;


public class TestHelloWorld {

   private HelloWorld h;

   @Before
   public void setUp() throws Exception
   {
      h = new HelloWorld();
   }

   @Test
   public void testHelloEmpty()
   {
      assertEquals(h.getName(),"");
      assertEquals(h.getMessage(),"Hello!");
   }

   @Test
   public void testHelloWorld()
   {
      h.setName("World");
      assertEquals(h.getName(),"World");
      assertEquals(h.getMessage(),"Hello World!");
   }
}`
                },
                {
                    name: 'AllTests.java',
                    data: `import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import junit.framework.JUnit4TestAdapter;

// This section declares all of the test classes in your program.
@RunWith(Suite.class)
@Suite.SuiteClasses({
   TestHelloWorld.class  // Add test classes here.
})

public class AllTests
{
	//This can be empty if you are using an IDE that includes support for JUnit
	//such as Eclipse.  However, if you are using Java on the command line or
	//with a simpler IDE like JGrasp or jCreator, the following main() and suite()
	//might be helpful.

    // Execution begins at main().  In this test class, we will execute
    // a text test runner that will tell you if any of your tests fail.
    public static void main (String[] args)
    {
       junit.textui.TestRunner.run (suite());
    }

    // The suite() method is helpful when using JUnit 3 Test Runners or Ant.
    public static junit.framework.Test suite()
    {
       return new JUnit4TestAdapter(AllTests.class);
    }

}`
                }
            ]},
            compileTimeoutMs : 1000000,
            executionTimeoutMs : 1000000

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
