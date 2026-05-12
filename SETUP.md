# Infrastructure Setup Steps (for Production Account)

## What we set up for testing (account 232235993015, ap-southeast-1)

### 1. IAM Role for SageMaker

```bash
# Create role that SageMaker can assume
aws iam create-role \
  --role-name SageMakerNotebookRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "sagemaker.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach policies
aws iam attach-role-policy \
  --role-name SageMakerNotebookRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonSageMakerFullAccess

aws iam attach-role-policy \
  --role-name SageMakerNotebookRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

### 2. SageMaker Notebook Instance (GPU)

```bash
# Create notebook with GPU for 3D model testing
# ml.g5.xlarge NOT available in ap-southeast-1 for notebooks
# ml.g4dn.xlarge works (NVIDIA T4 GPU, 16GB VRAM)
aws sagemaker create-notebook-instance \
  --notebook-instance-name ar-door-3d-test \
  --instance-type ml.g4dn.xlarge \
  --role-arn arn:aws:iam::<ACCOUNT_ID>:role/SageMakerNotebookRole \
  --volume-size-in-gb 50 \
  --region ap-southeast-1
```

**Cost:** ml.g4dn.xlarge = ~$0.94/hr in ap-southeast-1. **STOP IT WHEN DONE.**

```bash
# Stop notebook when finished testing
aws sagemaker stop-notebook-instance \
  --notebook-instance-name ar-door-3d-test \
  --region ap-southeast-1

# Delete when no longer needed
aws sagemaker delete-notebook-instance \
  --notebook-instance-name ar-door-3d-test \
  --region ap-southeast-1
```

### 3. Get Notebook URL

```bash
aws sagemaker create-presigned-notebook-instance-url \
  --notebook-instance-name ar-door-3d-test \
  --region ap-southeast-1
```

---

## For Production Account (repeat these steps)

1. Create IAM role with SageMaker + S3 access
2. Create notebook instance (or use SageMaker Studio)
3. For production endpoint: deploy model as SageMaker Endpoint (async inference recommended)
4. Additional resources needed:
   - S3 bucket for uploads + GLB assets
   - DynamoDB table for job metadata
   - API Gateway + Lambda (or Next.js API routes on Amplify)
   - Amplify hosting for frontend
   - CloudFront for asset delivery (optional, Amplify handles frontend)

## Region Notes

- `ap-southeast-5` (Malaysia): SageMaker Notebook Instances NOT supported
- `ap-southeast-1` (Singapore): Full SageMaker support, ml.g4dn.xlarge available
- `us-west-2` (Oregon): Full support including ml.g5.xlarge (better GPU, used by reference app)
