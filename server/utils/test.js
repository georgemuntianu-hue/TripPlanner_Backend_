import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

// Creezi o instanță simplă de test sau imporți app-ul tău din server
const app = express();
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

describe('GET /api/health', () => {
    it('returnează status OK', async () => {
        const response = await request(app).get('/api/health');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('OK');
    });
});