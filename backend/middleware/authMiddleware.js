const jwt = require('jsonwebtoken');

// Middleware to protect routes and enforce role-based access control
const protect = (roles = []) => {
    return (req, res, next) => {
        let token;

        // Check if authorization header exists and starts with Bearer
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'Not authorized, no token provided' });
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Attach user payload to request (contains id and role)
            req.user = decoded;
            
            // Check if the user's role is allowed to access this route
            if (roles.length && !roles.includes(req.user.role)) {
                return res.status(403).json({ message: 'Forbidden: Insufficient permissions to access this resource' });
            }
            
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Not authorized, token failed or expired' });
        }
    };
};

module.exports = { protect };
