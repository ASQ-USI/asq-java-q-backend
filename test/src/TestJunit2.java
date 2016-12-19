import org.junit.*;

import static org.junit.Assert.assertEquals;

public class TestJunit2 extends SecureTest {

    String message = "Hello World";
    MessageUtil messageUtil = new MessageUtil(message);

    @Test
    public void testPrintMessage() {
        assertEquals(message, messageUtil.printMessage());
    }

    @Test
    public void foo() {
        assertEquals(1, 1);
    }
}