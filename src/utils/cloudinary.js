import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) {
            throw new Error("No file path provided"); // ✅ FIXED: Added error handling for missing path
        }
        
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });
        console.log("file is uploaded on cloudinary ", response.url)
        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        return null;
    }
};


const deleteFromCloudinary = async (fileUrl) => {
    try {
        if (!fileUrl) {
            throw new Error("No file URL provided"); // ✅ FIXED: Added validation for missing file URL
        }
        
        const publicId = fileUrl.split("/").pop().split(".")[0];

        console.log("🗑️ Deleting file from Cloudinary:", publicId); // ✅ Added logging for debugging

        const response = await cloudinary.uploader.destroy(publicId);

        console.log("✅ File deleted successfully:", response);

        // Delete from Cloudinary


        return response;
    } catch (error) {
        console.error("Cloudinary Deletion Error:", error);
        return null;
    }
};


export { uploadOnCloudinary, deleteFromCloudinary };


