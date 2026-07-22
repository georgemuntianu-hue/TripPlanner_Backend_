import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
    try {
        // Caută header-ul indiferent dacă e trimis cu litere mari sau mici
        const authHeader = req.headers['authorization'] || req.headers['Authorization'] || req.headers['x-access-token'];

        let token = null;

        if (authHeader) {
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            } else {
                token = authHeader;
            }
        }

        if (!token) {
            console.error("[Auth Middleware]: Cerere respinsă - lipsește Token-ul!");
            return res.status(401).json({ message: 'Token de autentificare lipsă.' });
        }

        // Folosește aceeași cheie secretă ca în rute
        const secret = process.env.JWT_SECRET || 'secret_cheie';
        const decoded = jwt.verify(token, secret);

        // Salvează ID-ul utilizatorului în mod redundant pe obiectul de cerere
        const userId = decoded.id || decoded.userId;
        req.userId = userId;
        req.user = { id: userId, email: decoded.email };

        next();
    } catch (error) {
        console.error("❌ [Auth Middleware Error]: Token invalid sau expirat!", error.message);
        return res.status(401).json({ message: 'Sesiune expirată sau token invalid.' });
    }
};

export default authMiddleware;