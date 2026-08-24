const { randomUUID } = require('node:crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3, bucket } = require('../../infra/storage/s3.js');

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function sign(req, res) {
  const { filename, contentType, size } = req.body;
  const key = `uploads/${req.user.id}/${randomUUID()}-${sanitizeFilename(filename)}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: 300 },
  );

  // The S3 API endpoint (used above for the signed PUT) isn't necessarily
  // where the provider serves public GETs from -- true for MinIO and R2,
  // but Supabase Storage's S3-compatible endpoint is upload/management
  // only; public files live under a different path on a different host.
  // S3_PUBLIC_URL_BASE overrides it for providers where the two diverge.
  const publicBase = process.env.S3_PUBLIC_URL_BASE || process.env.S3_ENDPOINT;
  const fileUrl = `${publicBase}/${bucket}/${key}`;

  res.json({ uploadUrl, fileUrl });
}

module.exports = { sign };
