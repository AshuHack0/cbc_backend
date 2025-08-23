import { executeQuery2 } from "../config/db.js";
import { SQL_QUERIES } from "../queries/queries.js";

export const createBannerController = async (req, res) => {
    try {
        const { link } = req.body;
         console.log(link);
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Image file is required"
            });
        }

        // Generate public URL for the uploaded image
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const imageUrl = `${baseUrl}/uploads/banners/${req.file.filename}`;
        
        // Use link if provided, otherwise use null
        const linkUrl = link || null;
        
        const banner = await executeQuery2(SQL_QUERIES.CREATE_BANNER, [imageUrl, linkUrl]);
        
        res.status(200).json({
            success: true,
            message: "Banner created successfully",
            banner: banner,
            imageUrl: imageUrl
        });
    } catch (error) {
        res.status(500).json({  
            success: false,
            message: "Error creating banner",
            error: error.message
        });
    }
}


export const getBannersController = async (req, res) => {
    try {
        const banners = await executeQuery2(SQL_QUERIES.GET_BANNERS);
        res.status(200).json({
            success: true,
            message: "Banners fetched successfully",
            banners: banners
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching banners",
            error: error.message
        });
    }
}


//delete banner
export const deleteBannerController = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await executeQuery2(SQL_QUERIES.DELETE_BANNER, [id]);
        res.status(200).json({
            success: true,
            message: "Banner deleted successfully",
            banner: banner
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error deleting banner",
            error: error.message
        });
    }
}


// update banner
export const updateBannerController = async (req, res) => {
    try {
        const { id } = req.params;
        const { link } = req.body;
        
        // Get existing banner data first
        const existingBanner = await executeQuery2(SQL_QUERIES.GET_BANNER_BY_ID, [id]);
        if (!existingBanner || existingBanner.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Banner not found"
            });
        }
        
        let imageUrl = existingBanner[0].image_link;
        let linkUrl = existingBanner[0].link_url;
        
        // Update image if new one is uploaded
        if (req.file) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            imageUrl = `${baseUrl}/uploads/banners/${req.file.filename}`;
        }
        
        // Update link if provided in request body
        if (link !== undefined && link !== null && link !== '') {
            linkUrl = link;
        }
        
        // Update with both image and link (preserving unchanged values)
        const banner = await executeQuery2(SQL_QUERIES.UPDATE_BANNER, [imageUrl, linkUrl, id]);
        
        res.status(200).json({
            success: true,
            message: "Banner updated successfully",
            banner: banner
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating banner",
            error: error.message
        });
    }
}