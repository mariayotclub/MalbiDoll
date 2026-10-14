import multer from "multer";
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const extensaoValida = file.originalname
        .toLowerCase()
        .endsWith(".svg");
    const mimeValido = file.mimetype === "image/svg+xml";
    if (!extensaoValida || !mimeValido) {
        return cb(new Error("Apenas arquivos SVG são permitidos."));
    }
    cb(null, true);
};
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1
    }
});
export default upload;
