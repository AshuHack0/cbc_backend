import { executeQuery2 } from "../config/db.js";
import { SQL_QUERIES } from "../queries/queries.js";

export const getAllRoomsController = async (req, res) => {
    try {
        const rooms = await executeQuery2(SQL_QUERIES.SELECT_ALL_ROOMS);
        res.status(200).json({
            success: true,
            message: "Rooms fetched successfully",
            rooms: rooms
        });
    } catch (error) {
        res.status(500).json({  
            success: false,
            message: "Error fetching rooms",
            error: error.message
        });
    }
};

export const getAllRoomsPaymentController = async (req, res) => {
    try {
        const rooms = await executeQuery2(SQL_QUERIES.GET_ALL_ROOMS_PAYMENT); 
        res.status(200).json({
            success: true,
            message: "Rooms payment fetched successfully",
            rooms: rooms
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching rooms payment",
            error: error.message
        });
    }
}   