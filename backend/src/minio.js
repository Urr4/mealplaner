const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const isLocal = () => (process.env.STORAGE_TYPE || 'minio') === 'local';
const BUCKET = process.env.MINIO_BUCKET || 'mealplaner';

// Internal client — used for API operations (upload, delete, bucket creation)
function getClient() {
  return new S3Client({
    endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || 'mealplaner',
      secretAccessKey: process.env.MINIO_SECRET_KEY || '***REMOVED***',
    },
    forcePathStyle: true,
  });
}

// Public client — presigned URLs must use a hostname the browser can reach
function getPublicClient() {
  const publicUrl = process.env.MINIO_PUBLIC_URL || process.env.MINIO_ENDPOINT || 'http://localhost:9000';
  return new S3Client({
    endpoint: publicUrl,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || 'mealplaner',
      secretAccessKey: process.env.MINIO_SECRET_KEY || '***REMOVED***',
    },
    forcePathStyle: true,
  });
}

async function ensureBucketExists(client) {
  try {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`[minio] Bucket "${BUCKET}" erstellt`);
  } catch (err) {
    const code = err.Code || err.name || '';
    if (code !== 'BucketAlreadyOwnedByYou' && code !== 'BucketAlreadyExists') {
      throw err;
    }
  }
}

async function uploadImage(key, buffer, mimetype) {
  if (isLocal()) return require('./local-storage').uploadImage(key, buffer, mimetype);
  const client = getClient();
  try {
    await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: mimetype }));
  } catch (err) {
    // Bucket missing — create it and retry once
    if (err.Code === 'NoSuchBucket' || err.name === 'NoSuchBucket' || err.$metadata?.httpStatusCode === 404) {
      console.log(`[minio] Bucket fehlt beim Upload — erstelle und versuche erneut`);
      await ensureBucketExists(client);
      await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: mimetype }));
    } else {
      throw err;
    }
  }
}

async function deleteImage(key) {
  if (isLocal()) return require('./local-storage').deleteImage(key);
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    // Bucket or object missing — not an error worth surfacing
    const code = err.Code || err.name || '';
    if (code !== 'NoSuchBucket' && code !== 'NoSuchKey') throw err;
  }
}

async function getImageUrl(key) {
  if (isLocal()) return require('./local-storage').getImageUrl(key);
  // Use public client so the presigned URL contains a hostname the browser can reach
  return getSignedUrl(getPublicClient(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 86400 });
}

module.exports = { uploadImage, deleteImage, getImageUrl };
