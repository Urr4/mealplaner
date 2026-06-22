const fs = require('fs');
const path = require('path');

const BASE_DIR = process.env.LOCAL_IMAGES_DIR || path.join(__dirname, '../../data/images');

function keyToPath(key) {
  return path.join(BASE_DIR, key.replace(/\//g, path.sep));
}

async function uploadImage(key, buffer) {
  const filePath = keyToPath(key);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

async function deleteImage(key) {
  try { fs.unlinkSync(keyToPath(key)); } catch { /* ignorieren */ }
}

async function getImageUrl(key) {
  return `/dev-images/${key}`;
}

module.exports = { uploadImage, deleteImage, getImageUrl, BASE_DIR };
