import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';

const router = express.Router();

// Cheie secretă unificată pentru tot proiectul
const JWT_SECRET = process.env.JWT_SECRET || 'secret_cheie';

// 1. REGISTER
router.post('/register', async (req, res) => {
    try {
        const { name, username, fullName, email, password } = req.body;

        // Preluăm numele indiferent dacă frontend-ul trimite name, username sau fullName
        const finalName = name || username || fullName;

        if (!finalName || !email || !password) {
            return res.status(400).json({ message: 'Toate câmpurile sunt obligatorii.' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Verificăm dacă emailul există deja
        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [cleanEmail]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Acest email este deja înregistrat.' });
        }

        // Criptăm parola
        const hashedPassword = await bcrypt.hash(password, 10);

        // Inserăm în MySQL
        const [result] = await db.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [finalName.trim(), cleanEmail, hashedPassword]
        );

        const newUserId = result.insertId;

        // Generăm token-ul pentru logare automată imediat după înregistrare
        const token = jwt.sign(
            { id: newUserId, userId: newUserId, email: cleanEmail, name: finalName },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(201).json({
            message: 'Cont creat cu succes!',
            token,
            user: { id: newUserId, name: finalName, email: cleanEmail }
        });

    } catch (error) {
        console.error("❌ Eroare Register:", error);
        return res.status(500).json({
            error: 'Eroare la crearea contului: ' + (error.sqlMessage || error.message)
        });
    }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email și parola sunt obligatorii.' });
        }

        const cleanEmail = email.trim().toLowerCase();

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [cleanEmail]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Email sau parolă incorectă.' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Email sau parolă incorectă.' });
        }

        // Generare Token
        const token = jwt.sign(
            { id: user.id, userId: user.id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(200).json({
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error("❌ Eroare Login:", error);
        return res.status(500).json({ error: 'Eroare la autentificare.' });
    }
});

// 3. ȘTERGERE CONT
router.delete('/delete-account', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

        if (!token) {
            return res.status(401).json({ message: 'Token de autentificare lipsă.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id || decoded.userId;

        const [trips] = await db.query('SELECT id FROM trips WHERE user_id = ?', [userId]);
        const tripIds = trips.map(t => t.id);

        if (tripIds.length > 0) {
            await db.query('DELETE FROM places WHERE trip_id IN (?)', [tripIds]);
            await db.query('DELETE FROM days WHERE trip_id IN (?)', [tripIds]);
            await db.query('DELETE FROM trips WHERE user_id = ?', [userId]);
        }

        const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Utilizatorul nu a fost găsit.' });
        }

        return res.status(200).json({ message: 'Contul și toate datele tale asociate au fost șterse definitiv.' });

    } catch (error) {
        console.error("❌ Eroare Ștergere Cont:", error);
        return res.status(500).json({ error: 'A apărut o eroare la ștergerea contului.' });
    }
});

export default router;