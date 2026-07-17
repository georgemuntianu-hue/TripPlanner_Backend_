import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            console.error("[Auth Middleware]: Cerere respinsă - lipsește Token-ul!");
            return res.status(401).json({ message: 'Token de autentificare lipsă.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_cheie');

        // Salvăm ID-ul utilizatorului în mod redundant ca să funcționeze pe toate rutele
        req.userId = decoded.id;
        req.user = { id: decoded.id, email: decoded.email };

        next();
    } catch (error) {
        console.error("[Auth Middleware Error]: Token invalid sau expirat!");
        return res.status(401).json({ message: 'Sesiune expirată sau token invalid.' });
    }
};

export default authMiddleware;