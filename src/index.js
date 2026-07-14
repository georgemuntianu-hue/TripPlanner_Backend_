import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Importăm rutele noastre
import authRoutes from './routes/auth.js';
import tripRoutes from './routes/trips.js';
import placesRoutes from './routes/places.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Obținem calea directorului curent pentru modulele ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Citim fișierul swagger.json pentru documentație
const swaggerPath = path.resolve(__dirname, '../swagger.json');
if (fs.existsSync(swaggerPath)) {
    const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
    // Rută Swagger curată, fără slash la sfârșit obligatoriu
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} else {
    console.log("Avertisment: Fișierul swagger.json nu a fost găsit la calea:", swaggerPath);
}

// 7. Montăm routerele la căile potrivite
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes); // Pasul cerut explicit în task!
app.use('/api/places', placesRoutes);

// Rută simplă de test pentru a vedea dacă serverul e activ
app.get('/', (req, res) => {
    res.send('Serverul TripPlanner rulează corect!');
});

app.listen(PORT, () => {
    console.log(`Serverul rulează pe http://localhost:${PORT}`);
    console.log(`Documentația Swagger este disponibilă la http://localhost:${PORT}/api-docs`);
});