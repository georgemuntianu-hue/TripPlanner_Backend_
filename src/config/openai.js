// server/src/config/openai.js
import dotenv from 'dotenv';
// Încărcăm variabilele de mediu din .env obligatoriu pe prima linie
dotenv.config();

import { GoogleGenAI } from '@google/genai';

// Inițializăm clientul unificat Google GenAI folosind cheia de la Google AI Studio
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

export default ai;