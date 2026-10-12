import path from 'path';
import multer from 'multer';
import { badRequest } from '../utils/httpError.js';

// Uploads are kept in memory and never written to a public folder:
// spreadsheets are parsed straight away, resource files are stored in the database.

const MB = 1024 * 1024;

/** File types a teacher can attach to an assessment, with the MIME type served on download. */
export const RESOURCE_TYPES = {
  '.pdf': ['pdf', 'application/pdf'],
  '.doc': ['document', 'application/msword'],
  '.docx': ['document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.ppt': ['document', 'application/vnd.ms-powerpoint'],
  '.pptx': ['document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.txt': ['document', 'text/plain'],
  '.jpg': ['image', 'image/jpeg'],
  '.jpeg': ['image', 'image/jpeg'],
  '.png': ['image', 'image/png'],
  '.gif': ['image', 'image/gif'],
  '.webp': ['image', 'image/webp'],
};

export const RESOURCE_MAX_MB = 5;

/** Wraps a multer middleware so its errors become clear 400s. */
const friendly = (middleware, { maxMb, field }) => (req, res, next) =>
  middleware(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(badRequest(`The file is larger than ${maxMb} MB.`));
    if (error instanceof multer.MulterError) return next(badRequest(`Upload one file in the “${field}” field`));
    return next(error);
  });

/** One CSV/XLSX register, up to 2 MB, in req.file. */
export const uploadSpreadsheet = friendly(
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * MB, files: 1 } }).single('file'),
  { maxMb: 2, field: 'file' }
);

/** One assessment resource (documents and images), up to 5 MB, in req.file. Optional: links have no file. */
export const uploadResource = friendly(
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: RESOURCE_MAX_MB * MB, files: 1 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (RESOURCE_TYPES[ext]) cb(null, true);
      else cb(badRequest('Attach a PDF, Word or PowerPoint document, text file or image'));
    },
  }).single('file'),
  { maxMb: RESOURCE_MAX_MB, field: 'file' }
);
