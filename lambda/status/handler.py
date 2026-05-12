import json
import os
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["JOBS_TABLE"])


def handler(event, context):
    """Check job status and return model URL if complete."""
    job_id = event["pathParameters"]["jobId"]

    job = table.get_item(Key={"jobId": job_id}).get("Item")
    if not job:
        return {"statusCode": 404, "body": json.dumps({"error": "Job not found"})}

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({
            "jobId": job_id,
            "status": job["status"],
            "modelUrl": job.get("modelUrl"),
        }),
    }
