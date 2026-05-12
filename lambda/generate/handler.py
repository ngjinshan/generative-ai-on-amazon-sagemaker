import json
import os
import boto3

sagemaker_runtime = boto3.client("sagemaker-runtime")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["JOBS_TABLE"])
s3 = boto3.client("s3")

UPLOAD_BUCKET = os.environ["UPLOAD_BUCKET"]
ASSETS_BUCKET = os.environ["ASSETS_BUCKET"]
SAGEMAKER_ENDPOINT = os.environ["SAGEMAKER_ENDPOINT"]


def handler(event, context):
    """Trigger 3D model generation from uploaded door photos."""
    body = json.loads(event["body"])
    job_id = body["jobId"]

    # Get job info
    job = table.get_item(Key={"jobId": job_id})["Item"]
    image_keys = job["imageKeys"]

    # Update status
    table.update_item(
        Key={"jobId": job_id},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "PROCESSING"},
    )

    # Download the primary image (front view)
    primary_key = image_keys[0]
    img_obj = s3.get_object(Bucket=UPLOAD_BUCKET, Key=primary_key)
    image_bytes = img_obj["Body"].read()

    # Invoke SageMaker endpoint (InstantMesh / TripoSR)
    response = sagemaker_runtime.invoke_endpoint(
        EndpointName=SAGEMAKER_ENDPOINT,
        ContentType="application/octet-stream",
        Body=image_bytes,
    )

    # Response is a GLB binary
    glb_bytes = response["Body"].read()
    output_key = f"models/{job_id}/door.glb"
    s3.put_object(Bucket=ASSETS_BUCKET, Key=output_key, Body=glb_bytes, ContentType="model/gltf-binary")

    # Build CloudFront URL
    cdn_domain = os.environ.get("CDN_DOMAIN", f"{ASSETS_BUCKET}.s3.amazonaws.com")
    model_url = f"https://{cdn_domain}/{output_key}"

    # Update job as complete
    table.update_item(
        Key={"jobId": job_id},
        UpdateExpression="SET #s = :s, modelUrl = :u",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "COMPLETE", ":u": model_url},
    )

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"jobId": job_id, "status": "COMPLETE", "modelUrl": model_url}),
    }
