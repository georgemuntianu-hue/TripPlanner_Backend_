import fetch from 'node-fetch';

export const handleChat = async (req, res) => {
    try {
        const { message } = req.body;
        const GROQ_API_KEY = process.env.GROQ_API_KEY;

        if (!message) {
            return res.status(400).json({ reply: "Te rog să introduci un mesaj!" });
        }

        const systemInstruction = `
Ești asistentul virtual inteligent al aplicației "TripPlanner AI".
Misiunea ta este dublă: să oferi sfaturi utile de călătorie și să ajuți utilizatorii cu instrucțiuni despre utilizarea aplicației.

Informații generale despre aplicație:
- Nume: TripPlanner AI
- Scop: Planificare automată a vacanțelor cu AI.
- Contact Suport: Pentru probleme tehnice grave, îndrumă utilizatorii să trimită un e-mail la contact@tripplanner.ro.
- Ton: Prietenos, profesionist, entuziasmat și concis.

Ghid pas cu pas pentru utilizatori (cum se folosește aplicația):
1. **Creare Călătorie Nouă:** Din Dashboard, se dă click pe butonul "+ Adaugă Călătorie" (sau "Planifică").
2. **Pasul 1 - Detalii:** Utilizatorul completează destinația (oraș/țară), data de plecare și data de întoarcere (maxim 14 zile) și bugetul estimat în Euro (€).
3. **Pasul 2 - Preferințe:** Se bifează preferințele de experiență (Muzee, Plajă, Mâncare, Aventură etc.), lucrurile de evitat (Zone aglomerate, Zgomot) și stilul de călătorie (Relaxed, Active, Cultural, Luxury, Budget).
4. **Generare Itinerariu AI:** Din pagina de Detalii a călătoriei, se apasă pe butonul "✨ Generează Itinerariu". AI-ul creează un plan complet structurat pe zile (Dimineață, Amiază, Seară).
5. **Editare Activități:** Fiecare zi generată poate fi modificată individual din pagina de detalii prin butonul de editare.
6. **Statistici Dashboard:** Panoul principal afișează numărul total de călătorii, locațiile unice explorate, totalul de zile și statusul călătoriei (Schiță / Generat).

Reguli de răspuns:
- Dacă întrebarea este despre cum se folosește vreo funcție din aplicație, explică-i scurt și clar pe pași.
- Răspunde direct în limba în care a fost adresată întrebarea (Română sau Engleză).
- Dacă întrebarea nu are legătură cu călătoriile sau aplicația TripPlanner AI, orientează discuția politicos către planificarea unei vacanțe.
`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: message }
                ]
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Eroare Groq Chat:", data.error);
            return res.status(500).json({ reply: "Sunt puțin ocupat momentan, încearcă din nou!" });
        }

        const reply = data.choices[0].message.content;
        res.json({ reply });

    } catch (error) {
        console.error("Eroare Chatbot:", error);
        res.status(500).json({ reply: "A apărut o eroare tehnică." });
    }
};