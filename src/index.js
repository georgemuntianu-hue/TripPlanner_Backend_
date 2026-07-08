import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Apelam verificarea bazei de date
testConnection();

app.listen(PORT, () => {
    console.log(`Serverul ruleaza pe portul ${PORT}`);
});