import json
import os
import uuid
import boto3

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["JOBS_TABLE"])

UPLOAD_BUCKET = os.environ["UPLOAD_BUCKET"]


def handler(event, context):
    """Generate presigned URLs for door photo uploads."""
    body = json.loads(event["body"])
    file_names = body["fileNames"]
    file_types = body["fileTypes"]

    job_id = str(uuid.uuid4())
    upload_urls = []

    for i, (name, content_type) in enumerate(zip(file_names, file_types)):
        key = f"uploads/{job_id}/{i}_{name}"
        url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": UPLOAD_BUCKET, "Key": key, "ContentType": content_type},
            ExpiresIn=300,
        )
        upload_urls.append(url)

    # Create job record
    table.put_item(Item={"jobId": job_id, "status": "PENDING", "imageKeys": [f"uploads/{job_id}/{i}_{n}" for i, n in enumerate(file_names)]})

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"jobId": job_id, "uploadUrls": upload_urls}),
    }
