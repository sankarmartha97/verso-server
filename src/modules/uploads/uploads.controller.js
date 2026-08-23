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

  const fileUrl = `${process.env.S3_ENDPOINT}/${bucket}/${key}`;

  res.json({ uploadUrl, fileUrl });
}

module.exports = { sign };
