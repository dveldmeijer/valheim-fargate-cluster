# Valheim server aws fargate cluster

## Requirements

* Nodejs
* The Aws Cloud Development Kit

## Useful commands

* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## Start a server

### Set up your aws account details in the contet (cdk.json) or in your environment

cdk.json:

    "aws-account-id": "xxxxxxx",
    "aws-region": "eu-central-1",

### Set up the server details in the context (cdk.json)

cdk.json:

    "valheimServerDockerEnvironmentVariables": {
      "SERVER_NAME": "MyServer",
      "SERVER_PASS": "MyPassword",
      "WORLD_NAME": "MyWorldName"
    },

### Deploy the stack

`cdk deploy`

### Turn the server on or off

Modify the desired task in the ValheimServerService in the AWS console

## Modify settings

Edit settings by passing context when deploying the stack.
You can edit the context in `cdk.json` or pass the context on the command line.

### Context variables

- `valheimServerDockerEnvironmentVariables`
 
    Environment variables that are passed to the server docker container. 
    Valid variables are described here: https://hub.docker.com/r/lloesche/valheim-server    
    ```
    "valheimServerDockerEnvironmentVariables": {
        "SERVER_NAME": "MyServer",
        "WORLD_NAME": "MyWorldName"
    },
   ```
  
- `memoryLimit` and `cpuLimit`

    Use the values from the Fargate table at https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html
    ```
    "memoryLimit": 4096,
    "cpuLimit": 2048,
    ```
- `fileSystemId` (optional)

    The id of an existing efs filesystem
    ```
    "fileSystemId": "fs-00000000"
    ```
- `sshDockerEnvironmentVariables`
  
  Environment variables that are passed to the ssh docker container. Valid variables are described 
  here: https://hub.docker.com/r/linuxserver/openssh-server
  ```
  "sshDockerEnvironmentVariables": {
    "SUDO_ACCESS": "true",
    "USER_NAME": "valheim",
    "PASSWORD_ACCESS": "true",
    "USER_PASSWORD": "myUnsecurePassword"
  }
  ```


## Upload or download world files

Connect to the filesystem through the FileManagement service that was created in the Valheim cluster

### Set up SSH access 

Modify the `sshDockerEnvironmentVariables` context to set up SSH access

### Enable the FileManagement service

The FileManagement service is by default created without running tasks. Login to the AWS console and navigate to the FileSystem 
service in the Valheim ECS cluster. Edit the service and set the `Desired Tasks` to 1. 

**Do not forget to set desired tasks to 0 after you are done to prevent unwanted costs**

### Connect to the FileManagement container

Grab the public ip address of the container from the Task `networking` tab.

Connect through port 2222

The valheim config is mounted at `/valheim_data`

Example download of the world files to local /tmp folder:

```scp -P 2222 valheim@<ip_address>:/valheim_data/worlds/Dedicated.* /tmp```

Example upload:

```scp -P 2222 /tmp/Dedicated.* valheim@<ip_address:/valheim_data/worlds/```