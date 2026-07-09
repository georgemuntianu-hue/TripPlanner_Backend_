import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { testConnection } from './config/db.js';
import authRouter from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Permitem doar frontend-ului nostru de pe portul 3000 să acceseze datele
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// RUTA PRINCIPALĂ DE AUTENTIFICARE (Cerința 8 din task)
app.use('/api/auth', authRouter);

// Rută simplă de health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', database: 'connected' });
});

async function pornireAplicatie() {
    await testConnection();
    app.listen(PORT, () => {
        console.log(`🚀 [BACKEND] Serverul rulează curat pe http://localhost:${PORT}`);
    });
}

pornireAplicatie();