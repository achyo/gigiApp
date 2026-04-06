const cloudinary = require('cloudinary').v2;
const multer = require('multer');

function normalizeCloudName(value) {
  return typeof value === 'string' ? value.trim().replace(/^@+/, '') : value;
}

cloudinary.config({
  cloud_name: normalizeCloudName(process.env.CLOUDINARY_CLOUD_NAME),
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const folder = process.env.CLOUDINARY_FOLDER || 'proyecto-gigi';

function makeUploader() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });
}

function uploadBufferToCloudinary(buffer, subfolder, allowedFormats = ['jpg', 'jpeg', 'png', 'webp']) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${folder}/${subfolder}`,
        allowed_formats: allowedFormats,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

async function deleteByPublicId(publicId) {
  if (!publicId) return;
  return cloudinary.uploader.destroy(publicId);
}

module.exports = { cloudinary, makeUploader, uploadBufferToCloudinary, deleteByPublicId };
