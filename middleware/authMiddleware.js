import JWT from 'jsonwebtoken';

export const isAuthenticated = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token from "Bearer <token>"
    
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // Verify the token
    JWT.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        // Attach the decoded user information to the request object
        req.user = decoded;
        next();
    });
};