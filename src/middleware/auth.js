import jwt from 'jsonwebtoken';

export default function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Acces refuzat. Token lipsă.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_trip_planner');
        req.userId = decoded.id; // Salvăm id-ul pentru rutele de CRUD
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Token invalid sau expirat.' });
    }
}