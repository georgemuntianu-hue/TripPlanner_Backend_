import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Documentație Swagger cu AMBELE endpoint-uri scrise direct
const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'TripPlanner API - Autentificare & Înregistrare',
        version: '1.0.0',
        description: 'Documentație API oficială. Testează rutele de register și login live!',
    },
    servers: [
        {
            url: 'http://localhost:3001',
        },
    ],
    paths: {
        '/api/auth/register': {
            post: {
                summary: 'Înregistrare utilizator nou (Register)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'email', 'password'],
                                properties: {
                                    name: { type: 'string', example: 'George Munteanu' },
                                    email: { type: 'string', example: 'student@scoala.ro' },
                                    password: { type: 'string', example: 'parola123' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: { description: 'Creat cu succes!' },
                    400: { description: 'Eroare de validare.' }
                }
            }
        },
        '/api/auth/login': {
            post: {
                summary: 'Autentificare utilizator existent (Login)',
                description: 'Introduceți email-ul și parola pentru a primi un token JWT valid.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password'],
                                properties: {
                                    email: {
                                        type: 'string',
                                        example: 'student@scoala.ro',
                                        description: 'Email-ul cu care v-ați înregistrat'
                                    },
                                    password: {
                                        type: 'string',
                                        example: 'parola123',
                                        description: 'Parola contului'
                                    }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Autentificare reușită! Returnează cod 200 și token JWT.'
                    },
                    400: {
                        description: 'Eroare status 400: Lipsește email-ul sau parola din cerere.'
                    },
                    401: {
                        description: 'Eroare status 401: Date incorecte (mesaj generic securizat).'
                    }
                }
            }
        }
    }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`[BACKEND] Serverul rulează perfect pe portul ${PORT}.`);
});