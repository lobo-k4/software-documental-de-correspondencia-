const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, callback) => {
    callback(null, ['image/jpeg', 'image/png'].includes(file.mimetype));
  }
});

module.exports = upload;
