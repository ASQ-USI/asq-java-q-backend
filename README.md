# asq-java-q-backend

### Info

Backend for sandboxed Java execution for the asq-java-q question type

To run the service, you need docker running on the machine.
It uses /var/run/docker.socket to connect to it, so on windows it may not be working.

Before installing npm dependencies with ```$ npm install``` make sure that docker is running.
Otherwise you need to do ```$ docker pull openjdk:8u111-jdk``` to download the right openjdk image.


### Communication API


Request :
```
{
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
timeLimitCompile : 200,
timeLimitExecution : 200
}
```

Response:
```
{
clientId: String,
passed: Boolean,
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
