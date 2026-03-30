const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const folder = process.env.CLOUDINARY_FOLDER || 'proyecto-gigi';

function makeUploader(subfolder, allowedFormats = ['jpg', 'jpeg', 'png', 'webp']) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `${folder}/${subfolder}`,
      allowed_formats: allowedFormats,
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    },
  });
  return multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
}

async function deleteByPublicId(publicId) {
  if (!publicId) return;
  return cloudinary.uploader.destroy(publicId);
}

module.exports = { cloudinary, makeUploader, deleteByPublicId };
