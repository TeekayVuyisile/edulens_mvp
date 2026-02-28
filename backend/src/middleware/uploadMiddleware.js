import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage for assessment resources
const resourceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'assessment-' + uniqueSuffix + ext);
  }
});

// File filter for assessment resources
const resourceFileFilter = (req, file, cb) => {
  const allowedTypes = [
    '.pdf', '.doc', '.docx', '.txt', '.rtf', // Documents
    '.jpg', '.jpeg', '.png', '.gif', '.webp', // Images
    '.mp4', '.avi', '.mov', '.wmv', '.mkv',  // Videos
    '.mp3', '.wav', '.ogg', '.m4a'           // Audio
  ];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

// Create multer instances
export const uploadResource = multer({
  storage: resourceStorage,
  fileFilter: resourceFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for videos
  }
});

export const uploadSingle = (fieldName) => uploadResource.single(fieldName);
export const uploadMultiple = (fieldName, maxCount = 10) => uploadResource.array(fieldName, maxCount);