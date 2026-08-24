// S3-compatible object storage (MinIO in dev). AWS SDK v3 works against any
// S3-compatible provider unmodified with forcePathStyle -- region used to be
// hardcoded to 'us-east-1' (MinIO ignores it), but a real provider's request
// signing (AWS SigV4) incorporates the region into the signature, so a
// mismatch against the bucket's actual region breaks auth even with correct
// credentials. S3_REGION makes it configurable per provider.
const { S3Client, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');

const bucket = process.env.S3_BUCKET;

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_SECRET,
  },
});

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (err) {
      console.warn(`Could not create S3 bucket "${bucket}": ${err.message}`);
      return;
    }
  }

  try {
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    );
  } catch (err) {
    console.warn(`Could not set public-read policy on "${bucket}": ${err.message}`);
  }
}

module.exports = { s3, bucket, ensureBucket };
