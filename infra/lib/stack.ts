import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";

export class ArDoorVisualizerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Buckets
    const uploadBucket = new s3.Bucket(this, "UploadBucket", {
      cors: [{ allowedMethods: [s3.HttpMethods.PUT], allowedOrigins: ["*"], allowedHeaders: ["*"] }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const assetsBucket = new s3.Bucket(this, "AssetsBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CloudFront for 3D asset delivery
    const cdn = new cloudfront.Distribution(this, "AssetsCDN", {
      defaultBehavior: { origin: new origins.S3BucketOrigin(assetsBucket) },
    });

    // DynamoDB
    const jobsTable = new dynamodb.Table(this, "JobsTable", {
      partitionKey: { name: "jobId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Shared Lambda env
    const lambdaEnv = {
      JOBS_TABLE: jobsTable.tableName,
      UPLOAD_BUCKET: uploadBucket.bucketName,
      ASSETS_BUCKET: assetsBucket.bucketName,
      CDN_DOMAIN: cdn.distributionDomainName,
      SAGEMAKER_ENDPOINT: "door-3d-reconstruction", // Update after deploying SageMaker
    };

    // Lambda functions
    const uploadFn = new lambda.Function(this, "UploadFn", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.handler",
      code: lambda.Code.fromAsset("../lambda/upload"),
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(10),
    });

    const generateFn = new lambda.Function(this, "GenerateFn", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.handler",
      code: lambda.Code.fromAsset("../lambda/generate"),
      environment: lambdaEnv,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    const statusFn = new lambda.Function(this, "StatusFn", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.handler",
      code: lambda.Code.fromAsset("../lambda/status"),
      environment: lambdaEnv,
      timeout: cdk.Duration.seconds(10),
    });

    // Permissions
    uploadBucket.grantPut(uploadFn);
    uploadBucket.grantRead(generateFn);
    assetsBucket.grantPut(generateFn);
    jobsTable.grantReadWriteData(uploadFn);
    jobsTable.grantReadWriteData(generateFn);
    jobsTable.grantReadData(statusFn);

    // API Gateway
    const api = new apigateway.RestApi(this, "DoorApi", {
      defaultCorsPreflightOptions: { allowOrigins: ["*"], allowMethods: ["GET", "POST", "OPTIONS"] },
    });

    api.root.addResource("upload").addMethod("POST", new apigateway.LambdaIntegration(uploadFn));
    api.root.addResource("generate").addMethod("POST", new apigateway.LambdaIntegration(generateFn));
    api.root.addResource("status").addResource("{jobId}").addMethod("GET", new apigateway.LambdaIntegration(statusFn));

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", { value: api.url });
    new cdk.CfnOutput(this, "CdnDomain", { value: cdn.distributionDomainName });
  }
}
