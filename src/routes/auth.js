import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const router = express.Router();

router.post('/register', async (req, res) => {
    let { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Toate câmpurile sunt obligatorii.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Formatul email-ului nu este valid!' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Parola trebuie să aibă minim 6 caractere.' });
    }

    name = name.trim();
    email = email.trim().toLowerCase();

    try {
        const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Acest email este deja existent.' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const [result] = await pool.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

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
    }
});

export default router;