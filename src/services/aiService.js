// Cale salvare: server/src/services/aiService.js

/**
 * Simulează un răspuns inteligent de la AI pentru a ocoli limitările de API
 */
export const generateItinerary = async (trip) => {
    try {
        console.log(`[AI Mock] Se generează itinerarul pentru ${trip.destination}...`);

        // Simulăm o întârziere de 1.5 secunde pentru a imita un apel real de rețea
        await new Promise(resolve => setTimeout(resolve, 1500));

        const destination = trip.destination || "Destinație de vis";
        const start = new Date(trip.start_date || trip.startDate || Date.now());
        const end = new Date(trip.end_date || trip.endDate || Date.now());
        const totalDays = Math.ceil((end - start) / (1000 * 3600 * 24)) + 1 || 3;

        // Generăm dinamic zilele de itinerar în funcție de destinația primită
        const generatedDays = [];

        // Am eliminat spațiul din numele variabilei de mai jos:
        const activitatiInFunctieDeDestinatie = {
            morning: [
                `Mic dejun tradițional și plimbare prin centrul istoric din ${destination}.`,
                `Vizită la principalele muzee și puncte de atracție din zonă.`,
                `Explorarea piețelor locale și degustare de produse specifice.`
            ],
            afternoon: [
                `Prânz la un restaurant local recomandat și sesiune de shopping de suveniruri.`,
                `Tur ghidat prin cele mai cunoscute monumente istorice din ${destination}.`,
                `O plimbare relaxantă într-un parc faimos sau o croazieră scurtă.`
            ],
            evening: [
                `Cină romantică cu preparate tradiționale și băuturi locale.`,
                `Plimbare de seară pentru a admira arhitectura iluminată din ${destination}.`,
                `Relaxare la o terasă cochetă sau participarea la un eveniment local.`
            ],
            tips: [
                "Folosește transportul în comun local, este mult mai ieftin și rapid!",
                "Încearcă să ai întotdeauna niște bani cash la tine pentru micile cumpărături.",
                "Rezervă biletele online din timp ca să eviți cozile mari de la intrare."
            ]
        };

        for (let i = 1; i <= totalDays; i++) {
            const index = (i - 1) % 3; // Rotim activitățile ca să fie diferite de la o zi la alta
            generatedDays.push({
                day_number: i,
                title: `Ziua ${i}: Descoperă farmecul din ${destination}`,
                morning: activitatiInFunctieDeDestinatie.morning[index],
                afternoon: activitatiInFunctieDeDestinatie.afternoon[index],
                evening: activitatiInFunctieDeDestinatie.evening[index],
                tips: activitatiInFunctieDeDestinatie.tips[index]
            });
        }

        const mockResponse = {
            days: generatedDays
        };

        console.log("[AI Mock] Itinerar simulat cu succes:", mockResponse);
        return mockResponse;

    } catch (error) {
        console.error("Eroare la generarea mock-ului AI:", error);
        throw new Error("Serviciul de generare AI este temporar indisponibil.");
    }
};

/**
 * Lăsăm și buildPrompt-ul exportat ca să nu dea erori de import în rute
 */
export const buildPrompt = (trip) => {
    return `Mock prompt pentru ${trip.destination}`;
};