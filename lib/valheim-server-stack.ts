import * as cdk from '@aws-cdk/core';
import {CfnOutput, RemovalPolicy} from '@aws-cdk/core';
import * as ec2 from "@aws-cdk/aws-ec2";
import {SubnetType} from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import {Protocol} from "@aws-cdk/aws-ecs";
import * as efs from "@aws-cdk/aws-efs";
import * as logs from "@aws-cdk/aws-logs";

export class ValheimServerStack extends cdk.Stack {
    private readonly efsVolumeName = 'ValheimConfig'
    private readonly nfsPort = 2049

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new ec2.Vpc(this, "VPC", {
            maxAzs: 1,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: "ValheimServerPublicSubnet",
                    subnetType: SubnetType.PUBLIC
                }
            ]
        })

        const cluster = new ecs.Cluster(this, "Cluster", {
            vpc: vpc,
            capacityProviders: ["FARGATE"]
        })

        const efsSecurityGroup = new ec2.SecurityGroup(this, "EfsSecurityGroup", {
            vpc: vpc,
        })

        const efs = this.makeFileSystem(
            vpc,
            efsSecurityGroup,
            this.node.tryGetContext("fileSystemId"),
        );

        const efsVolume: ecs.Volume = {
            name: this.efsVolumeName,
            efsVolumeConfiguration: {
                fileSystemId: efs.fileSystemId,
            }
        }

        const serverService = this.makeServerService(cluster, efsVolume)
        const fileManagementService = this.makeFileManagementService(cluster, efsVolume)

        efsSecurityGroup.connections.allowFrom(serverService.connections, ec2.Port.tcp(this.nfsPort))
        efsSecurityGroup.connections.allowFrom(fileManagementService.connections, ec2.Port.tcp(this.nfsPort))

        new CfnOutput(this, "fileSystemId", {
            value: efs.fileSystemId
        });
    }

    protected makeFileSystem(vpc: ec2.Vpc, securityGroup: ec2.SecurityGroup, fileSystemId?: string): efs.IFileSystem {
        if (fileSystemId) {
            return this.getExistingFileSystem(vpc, securityGroup, fileSystemId)
        }

        return new efs.FileSystem(this, 'ValheimConfig', {
            vpc: vpc,
            securityGroup: securityGroup
        });
    }

    protected getExistingFileSystem(vpc: ec2.Vpc, securityGroup: ec2.SecurityGroup, fileSystemId: string): efs.IFileSystem {
        const fileSystem = efs.FileSystem.fromFileSystemAttributes(this, "ValheimConfig", {
            fileSystemId: fileSystemId,
            securityGroup: securityGroup
        })

        new efs.CfnMountTarget(this, "EfsMountTarget", {
            fileSystemId: fileSystem.fileSystemId,
            securityGroups: [securityGroup.securityGroupId],
            subnetId: vpc.publicSubnets[0].subnetId
        })

        return fileSystem
    }

    protected makeServerService(cluster: ecs.Cluster, volume: ecs.Volume): ecs.FargateService {
        const service = new ecs.FargateService(this, 'Server', {
            cluster: cluster,
            taskDefinition: new ecs.FargateTaskDefinition(this, 'Task', {
                memoryLimitMiB: this.node.tryGetContext("memoryLimit"),
                cpu: this.node.tryGetContext("cpuLimit"),
            }),
            desiredCount: 1,
            assignPublicIp: true
        });
        service.connections.allowFromAnyIpv4(
            ec2.Port.udpRange(2456, 2457)
        );
        service.taskDefinition.addVolume(volume);

        const container = new ecs.ContainerDefinition(this, "Container", {
            taskDefinition: service.taskDefinition,
            image: ecs.ContainerImage.fromRegistry(
                this.node.tryGetContext("valheimServerDockerContainer")
            ),
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'Server',
                logGroup: new logs.LogGroup(this, "ServerLogGroup", {
                    removalPolicy: RemovalPolicy.DESTROY,
                })
            }),
            portMappings: [
                {containerPort: 2456, protocol: Protocol.UDP},
                {containerPort: 2457, protocol: Protocol.UDP}
            ],
            environment: this.node.tryGetContext("valheimServerDockerEnvironmentVariables")
        });
        container.addMountPoints({
            containerPath: "/config",
            sourceVolume: volume.name,
            readOnly: false
        })

        return service
    }

    protected makeFileManagementService(cluster: ecs.Cluster, volume: ecs.Volume): ecs.FargateService {
        const service = new ecs.FargateService(this, 'FileManagement', {
            cluster: cluster,
            taskDefinition: new ecs.FargateTaskDefinition(this, 'FileManagementTask', {
                memoryLimitMiB: 1024,
                cpu: 256,
            }),
            desiredCount: 0,
            assignPublicIp: true
        });
        service.connections.allowFromAnyIpv4(
            ec2.Port.tcp(2222)
        );
        service.taskDefinition.addVolume(volume);

        const container = new ecs.ContainerDefinition(this, "FileManagementContainer", {
            taskDefinition: service.taskDefinition,
            image: ecs.ContainerImage.fromRegistry(
                this.node.tryGetContext("sshDockerContainer")
            ),
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: 'FileManagement',
                logGroup: new logs.LogGroup(this, "FileManagementLogGroup", {
                    removalPolicy: RemovalPolicy.DESTROY,
                })
            }),
            portMappings: [
                {containerPort: 2222, protocol: Protocol.TCP},
            ],
            environment: this.node.tryGetContext("sshDockerEnvironmentVariables")
        });
        container.addMountPoints({
            containerPath: "/valheim_data",
            sourceVolume: volume.name,
            readOnly: false
        })

        return service
    }
}
