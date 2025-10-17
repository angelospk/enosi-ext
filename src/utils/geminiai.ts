import { useSettingsStore } from '../stores/settings.store';

export async function askGeminiAi(cleanedData: any, messages: any) {
    console.log(`--- Έναρξη Ερώτησης στο GeminiAI ---`);

    const settingsStore = useSettingsStore();
    const apiKey = settingsStore.geminiApiKey;

    if (!apiKey) {
        alert("Το Gemini API Key δεν έχει οριστεί. Παρακαλώ, ορίστε το από την καρτέλα Ρυθμίσεις του extension.");
        return;
    }

    // 1. Construct the input text from the provided data
    const inputText = `
        ΠΕΡΣΙΝΑ ΣΤΟΙΧΕΙΑ:
        ${JSON.stringify(cleanedData, null, 2)}

        ΤΡΕΧΟΝΤΑ ΛΑΘΗ:
        ${JSON.stringify(messages, null, 2)}
    `;

    // 2. Define the request payload for the Gemini API
    const requestPayload = {
        contents: [
            {
                role: 'user',
                parts: [{ text: inputText }],
            },
        ],
        generationConfig: {
            temperature: 0,
            // The API uses 'generationConfig', not 'config' like the SDK
        },
        safetySettings: [ // It's good practice to include safety settings
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
        systemInstruction: {
            parts: [{
                text: `θα σου δωσω τα στοιχεια καποιων αγροτεμαχιων απο μια δηλωση οσδε περσινη ενος παραγωγου. Θα σου δωσω επισης και μια λιστα απο τα λαθη που μου βγαζει το συστημα στην αιτηση. Θελω να εστιασουμε στα ιδιοκτησιακα μονο. Ειτε θα αναφερουν λαθος ατακ, ειτε οτι δεν εχουμε δηλωσει ιδιοκτητη, ή αναλυτικα στοιχεια στην ιδιοκτησια. Αν εχουν λαθος ατακ χρειαζομαστε το ε9 απο το ονομα του ατομου που το νοικιαζει (του ενοικιαστη δλδ) το οποιο θα αναφερεται στα στοιχεια ιδιοκτησιας του αγροτεμαχιου.  Αν είναι μικτό το αγροτεμάχιο ή λέει λάθος ότι  το άθροισμα των  εκτάσεων που δηλώνετε από το ΑΤΑΚ είναι διαφορετικό από την [Ψηφιοπ. Έκταση]*[Ποσοστό Χρήσης] του αγροτεμαχίου, και αυτό είναι σημάδι ότι μάλλον πρόκειται για ληγμένο ενοικιαστηριο σε μικτό αγροτεμάχιο. Σε αλλη περιπτωση, μαλλον προκειται για ληγμενο ενοικιαστηριο οπου θα εχει ημερομηνια ληξης το 2024. Θελω να μου δωσεις μια λιστα αναλυτικα με τα ονοματα των ενοικιαστων που εχουν θεμα ειτε λαθος ατακ ειτε ληγμενο ενοικιαστηριο, και μετα  τα στοιχεια του αγροτεμαχιου που αντιστοιχει α/α, εκταση, τοποθεσια, ημερομηνιες, ατακ)
δωσε μου αναλυτικα και συντομα στο τελος τι χρειαζομαι απο το καθε ονομα:
και δωσε επισης μια λιστα μονο με τα ονοματα και διπλα μονο τι χρειαζεται ε9, ληγμενο ενοικ
ΓΡΑΨΕ ΠΑΝΩ ΤΟ ΑΦΜ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΤΗΣ ΑΙΤΗΣΗΣ`,
            }]
        }
    };

    // 3. Make the API call using fetch
    const model = 'gemini-1.5-flash'; // Using a fast and capable model
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Gemini API Error:", errorBody);
            alert(`Error calling Gemini API: ${errorBody.error.message}`);
            return;
        }

        const responseData = await response.json();
        
        // 4. Process the response
        if (responseData.candidates && responseData.candidates.length > 0) {
            const fullResponseText = responseData.candidates[0].content.parts.map((part: any) => part.text).join("");
            
            console.log("--- Πλήρης Απάντηση Gemini ---");
            console.log(fullResponseText);

            // Create a summary for the alert
            const summary = fullResponseText.split('\n').slice(0, 15).join('\n'); // Show first 15 lines
            alert("Ανάλυση Gemini AI:\n\n" + summary + "\n\n(Δείτε την κονσόλα για την πλήρη απάντηση)");

        } else {
            console.warn("Gemini API returned no candidates.", responseData);
            alert("Το Gemini AI επέστρεψε μια κενή απάντηση.");
        }

    } catch (error) {
        console.error("Failed to fetch from Gemini API:", error);
        alert("Αποτυχία επικοινωνίας με το Gemini API. Ελέγξτε την κονσόλα για λεπτομέρειες.");
    } finally {
        console.log(`--- Τέλος Ερώτησης στο GeminiAI ---`);
    }
}