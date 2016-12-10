# asq-java-q-backend

### Info

Backend for sandboxed Java execution for the asq-java-q question type

To run the service, you need docker running on the machine.
It uses /var/run/docker.socket to connect to it, so on windows it may not be working.

Before running the server the first time do:
- Run docker
- Run ```$ docker pull openjdk``` in terminal


### Communication API


Request :
```
{clientId : String,
fileName : String,
code : String,
timeLimit : Integer}
```

Response:
```
{clientId: String,
passed: Boolean,
output: String,
errorMessage: String,
timeOut: Boolean}
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
