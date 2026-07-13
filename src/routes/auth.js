import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';

const router = express.Router();

<<<<<<< Updated upstream
=======
// POST /api/auth/register
>>>>>>> Stashed changes
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email-ul și parola sunt obligatorii.' });
        }

        const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'Acest email este deja înregistrat.' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await db.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name || 'Utilizator', email, hashedPassword]
        );

<<<<<<< Updated upstream
        const userId = result.insertId;
        const jwtSecret = process.env.JWT_SECRET || 'secret_trip_planner';
        const jwtExpires = process.env.JWT_EXPIRES_IN || '1d';

        const token = jwt.sign(
            { userId: userId, email: email },
            jwtSecret,
            { expiresIn: jwtExpires }
        );

        return res.status(201).json({
            token,
            user: { id: userId, name, email }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Eroare internă de server.' });
=======
        res.status(201).json({ success: true, message: 'Cont creat cu succes!' });
    } catch (error) {
        console.error('❌ EROARE COMPLETĂ REGISTER:', error);
        res.status(500).json({ message: 'Eroare internă la înregistrare.', error: error.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email-ul și parola sunt obligatorii.' });
        }

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Email sau parolă incorectă.' });
        }

        const user = users[0];

        // Verificare compatibilă cu bcrypt și fallback text simplu
        const isPasswordValid = (password === user.password) || await bcrypt.compare(password, user.password).catch(() => false);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Email sau parolă incorectă.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'secret_trip_planner',
            { expiresIn: '24h' }
        );

        res.status(200).json({
            success: true,
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('❌ EROARE COMPLETĂ LOGIN:', error);
        res.status(500).json({ message: 'Eroare internă de server.', error: error.message });
>>>>>>> Stashed changes
    }
});

export default router;