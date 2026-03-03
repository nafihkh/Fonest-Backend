const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

module.exports = { uploadBufferToCloudinary };