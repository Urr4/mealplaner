const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

const BUCKET = process.env.MINIO_BUCKET || 'mealplaner';

async function ensureBucket() {
  if ((process.env.STORAGE_TYPE || 'minio') === 'local') {
    console.log('[storage] Lokaler Dateisystem-Speicher aktiv — MinIO übersprungen');
    return;
  }
  const client = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || 'mealplaner',
      secretAccessKey: process.env.MINIO_SECRET_KEY || '***REMOVED***',
    },
    forcePathStyle: true,
  });

  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.log(`[minio] Bucket "${BUCKET}" existiert bereits`);
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
      console.log(`[minio] Bucket "${BUCKET}" erstellt`);
    } catch (err) {
      console.warn(`[minio] Bucket konnte nicht erstellt werden (evtl. kein MinIO verfügbar): ${err.message}`);
    }
  }
}

module.exports = { ensureBucket };
