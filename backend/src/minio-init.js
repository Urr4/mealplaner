const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

const BUCKET = process.env.MINIO_BUCKET || 'mealplaner';
const MAX_ATTEMPTS = 30;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

  // Docker Swarm ignores depends_on — retry until MinIO is ready
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
      console.log(`[minio] Bucket "${BUCKET}" existiert bereits`);
      return;
    } catch (err) {
      // Bucket doesn't exist yet — try to create it
      if (err.$metadata?.httpStatusCode === 404 || err.name === 'NoSuchBucket' || err.Code === 'NoSuchBucket') {
        try {
          await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
          console.log(`[minio] Bucket "${BUCKET}" erstellt`);
          return;
        } catch (createErr) {
          console.warn(`[minio] Bucket anlegen fehlgeschlagen (Versuch ${attempt}/${MAX_ATTEMPTS}): ${createErr.message}`);
        }
      } else {
        // MinIO not reachable yet
        console.warn(`[minio] Noch nicht erreichbar (Versuch ${attempt}/${MAX_ATTEMPTS}): ${err.message}`);
      }

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  console.error(`[minio] Bucket "${BUCKET}" konnte nach ${MAX_ATTEMPTS} Versuchen nicht sichergestellt werden — Bilder funktionieren möglicherweise nicht`);
}

module.exports = { ensureBucket };
