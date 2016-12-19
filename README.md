# asq-java-q-backend

## branch of supporting Junit tests using a prestructured "orchestrator" JAVA class

### Info

Backend for sandboxed Java execution for the asq-java-q question type

To run the service, you need docker running on the machine.
It uses /var/run/docker.socket to connect to it, so on windows it may not be working.

Before installing npm dependencies with ```$ npm install``` make sure that docker is running.
Otherwise you need to do ```$ docker pull openjdk:8u111-jdk``` to download the right openjdk image.

To run the server use:

```$ node app.js [-p port number] [-a mongo adress] [-c mongo collection] [-d default concurrent jobs number] [-m max concurrent jobs number]```

Defaults are:
- Port number: 5016
- Mongo address: 127.0.0.1/queue
- Mongo collection: agendaJobs
- Default concurrent jobs number: 40
- Max concurrent jobs number: 70


### Communication API


Request (containing junit files):
```javascript
junitRequest = {
clientId : "1234",
submission : 
    {
    main: '',
    files: [
        {
            name: "class1.java",
            data: "void hello(){}"},
        {
            name: "Main.java",
            data: "void main(String[] args){}"
        }]
    },
    tests: [
        {
            name: "test1.java",
            data: "@Test public void foo(){}"
        },
        {
            name: "test2.java",
            data: "@Test public void bar(){ assert(1==2);}"
         }
    ],
    timeLimitCompileMs : 2000,
    timeLimitExecutionMs : 1000
}
```
Note: if there are files in `tests`, then `main` can be ommited as it is not needed.

Request (simple java code without tests):
```javascript
simpleRequest = {
clientId : "1234",
submission : 
    {
    main: 'Main.java',
    files: [
        {
            name: "class1.java",
            data: "void hello(){}"},
        {
            name: "Main.java",
            data: "void main(String[] args){}"
        }]
    },
    tests: [],
    timeLimitCompileMs : 2000,
    timeLimitExecutionMs : 1000
}
```
Note: `tests` field can be omitted.


Response (if test files exist and client code compiled):

```javascript
junitResponse = {
    clientId: String,
    passed: Boolean,        // True
    output: String,
    errorMessage: String,
    timeOut: Boolean,
    totalNumberOfTests: Integer,
    numberOfTestsPassed: Integer,
    testsOutput: String      // output of all failed tests
}
```

Response (if test files don't exist or client did not compile):

```javascript
simpleResponse = {
    clientId: String,
    passed: Boolean,         // `True` if compiled, `False` otherwise
    output: String,
    errorMessage: String,
    timeOut: Boolean
}
```

### Work with docker in terminal

- Run image in docker: 
```
$ docker run image
```
- List docker containers:
```
$ docker ps -a
```
- Kill all docker containers:
```
$ docker kill $(docker ps -aq)
```
- Remove all docker containers:
```
$ docker rm -v $(docker ps -aq)
```

### Client

Client.js is a script done to test the server. 
To run the client use:

```$ cd test```

```$ node client.js [-c number of client] [-s submission name]```

Defaults are:
- Number of client: 1
- Submission name: hwSub

Possible submission names are:
- hwSub
- infiniteSub
- rmSub
- getPropsSub
- junitSub

For each request it prints out the response and the time it took to receive it.
