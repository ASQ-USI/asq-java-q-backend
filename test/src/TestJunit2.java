import org.junit.*;
import static org.junit.Assert.assertEquals;

public class TestJunit2 {
	
    String message = "Hello World";
    MessageUtil messageUtil = new MessageUtil(message);

    @BeforeClass
    public static void startup(){
        try {
            System.setSecurityManager(new SecurityManager());
        } catch (java.security.AccessControlException exception) {
            // Security manager already present.
        }
    }

    @Test
    public void testPrintMessage() {
          assertEquals(message,messageUtil.printMessage());
    }

    @Test
    public void foo(){
       	assertEquals(1,1);
    }
}