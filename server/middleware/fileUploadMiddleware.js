import multer from "multer"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

// Ensure the uploads directory exists (needed on clean deploys like Render)
const uploadsDir = path.resolve("uploads")
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir)
    },
    filename: (req, file, cb) => {
        const ext = file.originalname.split(".").pop() || "bin"
        const fileName = crypto.randomUUID() + "." + ext
        cb(null, fileName)
    }
})

const upload = multer({ storage: storage })


export default upload
