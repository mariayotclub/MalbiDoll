import multer from 'multer';

// Guarda o arquivo temporariamente na memória RAM para podermos ler como texto
const storage = multer.memoryStorage();

// Filtra para aceitar apenas arquivos SVG
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/svg+xml' || file.originalname.endsWith('.svg')) {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos no formato .SVG são permitidos!'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // Limite opcional de 2MB por arquivo
});

export default upload;