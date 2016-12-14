import org.junit.runner.JUnitCore;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;
import java.lang.Class;
import org.json.simple.JSONObject;

import java.lang.IllegalArgumentException; // dummy exception

public class TestRunner {
	public static void main(String[] args) throws IllegalArgumentException {

   		Class[] javaTestClasses = new Class[args.length];

   		for (int i=0; i<args.length; i++){
        try{
   			  javaTestClasses[i] = Class.forName(args[i]);
        }catch(ClassNotFoundException e){
          throw new IllegalArgumentException(args[i]+".java not found or does not represent a Java class.");
        }
         
   		}

    
    Result result = JUnitCore.runClasses(javaTestClasses);

    System.out.println("_!*^&_test-output");
    

    JSONObject output = new JSONObject();
		output.put("totalNumberOfTests", result.getRunCount());
		output.put("numberOfTestsPassed", result.getRunCount() - result.getFailureCount());

    String stringOutput = "";
    	for (Failure failure : result.getFailures()) {
        	stringOutput += failure.toString()+"\n";
    	}
		
    output.put("testsOutput", stringOutput);

    System.out.println(output.toString());  

   }
}