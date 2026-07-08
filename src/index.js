import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Încarcă variabilele din fișierul .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Aplica middleware-urile globale
app.use(cors());
app.use(express.json());

// Endpoint GET /health
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Pornirea serverului
app.listen(PORT, () => {
    console.log(`Serverul ruleaza pe portul ${PORT}`);
});