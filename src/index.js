import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import pool, { testConnection } from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ⚠️ FOARTE IMPORTANT: CORS leagă frontend-ul de backend!
// Permite aplicației de pe portul 3000 (frontend) să trimită date la portul 3001 (backend)
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurația curată pentru Swagger
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'TripPlanner API Documentation',
            version: '1.0.0',
            description: 'API pur (JSON) pentru proiectul TripPlanner',
        },
        servers: [{ url: `http://localhost:${PORT}` }],
        paths: {
            '/health': {
                get: {
                    summary: 'Verifică starea serverului',
                    responses: { 200: { description: 'Server online.' } }
                }
            },
            '/add-user': {
                post: {
                    summary: 'Inserează un utilizator primit din Frontend',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        email: { type: 'string' },
                                        password: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        201: { description: 'Utilizator creat.' },
                        500: { description: 'Eroare bază de date.' }
                    }
                }
            }
        }
    },
    apis: [],
};

const swaggerSpecs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Ruta obligatorie
app.get('/health', (req, res) => {
    res.json({ status: 'ok', database: 'connected' });
});

// BACKEND PUR: Primește JSON -> Salvează -> Trimite înapoi tot JSON
app.post('/add-user', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, password]
        );
        // Trimitem un răspuns JSON standard, nu text HTML!
        res.status(201).json({ success: true, message: 'Utilizator salvat!', userId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

async function pornireAplicatie() {
    await testConnection();
    app.listen(PORT, () => {
        console.log(`[BACKEND] Serverul rulează pe http://localhost:${PORT}`);
        console.log(`[BACKEND] Swagger disponibil la http://localhost:${PORT}/api-docs`);
    });
}

pornireAplicatie();