const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const isLocal = () => (process.env.STORAGE_TYPE || 'minio') === 'local';
const BUCKET = process.env.MINIO_BUCKET || 'mealplaner';

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

async function uploadImage(key, buffer, mimetype) {
  if (isLocal()) return require('./local-storage').uploadImage(key, buffer, mimetype);
  await getClient().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: mimetype }));
}

async function deleteImage(key) {
  if (isLocal()) return require('./local-storage').deleteImage(key);
  await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

async function getImageUrl(key) {
  if (isLocal()) return require('./local-storage').getImageUrl(key);
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 3600 });
}

module.exports = { uploadImage, deleteImage, getImageUrl };
