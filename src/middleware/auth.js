import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
    try {
        // 1. Extrage antetul de autorizare
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Token lipsă sau format invalid.' });
        }

        // 2. Extrage token-ul propriu-zis
        const token = authHeader.split(' ')[1];

        // 3. Verifică și decodifică token-ul JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_cheie_trip');

        // 4. IMPORTANT: Salvăm ID-ul în ambele formate (userId și id) ca să fim siguri că rutele îl găsesc
        req.userId = decoded.userId || decoded.id;
        req.user = { id: decoded.userId || decoded.id };

        next(); // Trecem la următoarea funcție/rută
    } catch (error) {
        return res.status(401).json({ message: 'Token invalid sau expirat.', error: error.message });
    }
};

export default authMiddleware;