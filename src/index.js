import 'dotenv/config'; // Încarcă variabilele de mediu imediat
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Importă rutele
import authRoutes from './routes/auth.js';
import tripRoutes from './routes/trips.js';
import placesRoutes from './routes/places.js';
import chatRoutes from './routes/chat.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Obținem calea pentru modulele ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware-uri esențiale
app.use(cors());
app.use(express.json());

// Montăm routerele (o singură dată, ordonate)
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/chat', chatRoutes);

// Configurare Swagger
const swaggerPath = path.resolve(__dirname, '../swagger.json');
if (fs.existsSync(swaggerPath)) {
    const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} else {
    console.log("Avertisment: Fișierul swagger.json nu a fost găsit.");
}

// Rută test
app.get('/', (req, res) => {
    res.send('Serverul TripPlanner rulează corect!');
});

// Pornire server
app.listen(PORT, () => {
    console.log(`Serverul rulează pe http://localhost:${PORT}`);
    console.log(`Documentația Swagger la http://localhost:${PORT}/api-docs`);
});