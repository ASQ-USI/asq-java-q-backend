# asq-java-q-backend
Backend for sandboxed Java execution for the asq-java-q question type

To run the service, you need docker running on the machine.
It uses /var/run/docker.socket to connect to it, so on windows it may not be working.

At this point it accepts 3 messages over tcp connection in UTF8:

test docker
test java
<java code>
