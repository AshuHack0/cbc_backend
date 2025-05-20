import { executeQuery2 } from '../config/db.js';
import { LOG_MESSAGES, RESPONSE_MESSAGES } from '../constants/constants.js';
import logger from '../utils/logger.js';
import { SQL_QUERIES } from '../queries/queries.js';
export const getUserController = async (req, res) => {
    const { _id } = req.user;
    try {
        const [result] = await executeQuery2(SQL_QUERIES.SELECT_USER_DETAILS, [_id]);
        if (result) {
            res.status(200).json({ message: RESPONSE_MESSAGES.USER_DETAILS_RETRIEVED_SUCCESSFULLY, user: result });
        } else {
            res.status(404).json({ message: RESPONSE_MESSAGES.USER_NOT_FOUND });
        }
    } catch (error) {
        logger.error(LOG_MESSAGES.ERROR_IN_GET_USER(error));
        res.status(500).json({ message: RESPONSE_MESSAGES.USER_DETAILS_RETRIEVAL_FAILED, error });
    }
}; 