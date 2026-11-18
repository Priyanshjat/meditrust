import { v2 as cloudinary } from 'cloudinary';
import fs from "node:fs"
import dotenv from "dotenv";
dotenv.config();


// CLOUDINARY_URL format: cloudinary://<api_key>:<api_secret>@<cloud_name>
const urlParts = process.env.CLOUDINARY_URL?.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || urlParts?.[3],
    api_key: process.env.CLOUDINARY_API_KEY || urlParts?.[1],
    api_secret: process.env.CLOUDINARY_API_SECRET || urlParts?.[2]
});




const uploadToCloudinary = async (fileLink) => {
    try {
        // Upload an image/PDF
        return await cloudinary.uploader.upload(fileLink, {
            resource_type: "auto"
        });
    } catch (error) {
        console.error("Cloudinary upload failed:", error.message);
        // Cleanup the temp file so failed uploads don't pile up in uploads/
        if (fileLink && fs.existsSync(fileLink)) {
            fs.unlinkSync(fileLink);
        }
        // Rethrow so callers know the upload failed instead of
        // receiving undefined and crashing on `.secure_url`.
        throw error;
    }
};


export default uploadToCloudinary;
