import { GoogleGenAI } from "@google/genai";
import fs from "node:fs"
import uploadToCloudinary from "../../middleware/cloudinaryMiddleware.js";
import Prescription from "../../models/prescriptionModel.js";
import Product from "../../models/productModel.js";
import Pathologist from "../../models/pathologistModel.js";


const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Model fallback chain: if the newest flash model is saturated (503) or has
// been retired (404), automatically try the next one down.
const AI_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
];

const isTransientError = (message = "") =>
    /503|UNAVAILABLE|overloaded|high demand|429|RESOURCE_EXHAUSTED|rate limit/i.test(message);

const isModelUnavailableError = (message = "") =>
    /404|NOT_FOUND|no longer available|not found/i.test(message);

const isQuotaError = (message = "") =>
    /429|RESOURCE_EXHAUSTED|quota/i.test(message);

// Retries transient 503s (with a short delay) and falls back to the next
// model in the chain when the current one is overloaded or unavailable.
async function generateContent(params) {
    let lastError;

    for (const model of AI_MODELS) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                return await ai.models.generateContent({ ...params, model });
            } catch (error) {
                lastError = error;
                const message = String(error?.message || "");

                if (!isTransientError(message) && !isModelUnavailableError(message)) {
                    throw error; // programming/validation error — don't retry
                }

                if (isModelUnavailableError(message)) {
                    break; // this model is gone; move to the next one immediately
                }

                if (attempt < 2) {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            }
        }
    }

    throw lastError;
}

// Turn SDK errors into something a user can actually act on.
function describeAiError(error) {
    const message = String(error?.message || "");

    if (isQuotaError(message)) {
        return "The AI service has reached its usage limit for now. Please try again in a minute.";
    }
    if (isTransientError(message)) {
        return "The AI service is busy right now. Please try again in a few moments.";
    }
    if (isModelUnavailableError(message)) {
        return "The configured AI model is unavailable. Please try again later.";
    }
    return message;
}

const PROMPT = `
You are a medical prescription parser. Extract the following from this 
prescription image and return ONLY valid JSON, no markdown fences, no explanation:

{
  "patient_name": null,
  "doctor_name": null,
  "date": null,
  "medicines": [
    {
      "name": null,
      "dosage": null,
      "frequency": null,
      "duration": null,
      "notes": null
    }
  ],
  "diagnosis_notes": null
}

If any field is illegible or missing, use null. Do not guess medicine names 
you're not confident about — flag uncertain reads in "notes" instead.
`;


function fileToBase64(path) {
    return fs.readFileSync(path).toString("base64");
}

// Temp files may already have been removed by the Cloudinary middleware,
// so never let cleanup throw.
function safeUnlink(path) {
    try {
        if (path && fs.existsSync(path)) {
            fs.unlinkSync(path);
        }
    } catch (error) {
        console.error("Failed to remove temp file:", error.message);
    }
}

// Gemini occasionally wraps JSON in markdown fences despite the config;
// strip them before parsing so a stray fence doesn't fail the request.
function parseJson(text = "") {
    const cleaned = text
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
    return JSON.parse(cleaned);
}


const explainPrescription = async (req, res) => {

    let userId = req.user.id

    if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
    }

    const filePath = req.file.path;

    try {
        const base64 = fileToBase64(filePath);

        const response = await generateContent({
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: PROMPT },
                        {
                            inlineData: {
                                mimeType: req.file.mimetype,
                                data: base64,
                            },
                        },
                    ],
                },
            ],
            config: {
                responseMimeType: "application/json",
            },
        });

        const data = parseJson(response.text);

        const image = await uploadToCloudinary(filePath);
        if (!image?.secure_url) {
            return res.status(500).json({ error: "Could not store the uploaded prescription image" });
        }

        const prescription = new Prescription({
            user: userId,
            patient_name: data.patient_name,
            doctor_name: data.doctor_name,
            date: data.date,
            medicines: data.medicines,
            diagnosis_notes: data.diagnosis_notes,
            image: image.secure_url
        })

        await prescription.save()
        await prescription.populate("user")

        res.status(200).json(prescription)

    } catch (err) {
        console.error(err);
        const busy = isTransientError(String(err?.message || ""));
        res.status(busy ? 503 : 500).json({ error: "Extraction failed", details: describeAiError(err) });
    } finally {
        safeUnlink(filePath); // cleanup temp file
    }
}




const findMedicines = async (req, res) => {

    const pid = req.params.pid

    try {
        const prescription = await Prescription.findById(pid)

        if (!prescription) {
            return res.status(404).json({ error: "Prescription not found" })
        }

        if (String(prescription.user) !== String(req.user.id)) {
            return res.status(403).json({ error: "You are not allowed to view this prescription" })
        }

        const products = await Product.find()
            .select("name description price stock expiresOn isActive")
        const pathologists = await Pathologist.find()
            .select("laboratoryName laboratoryAddress specialization consultationFee availableDays workingHours isActive")

        const data = JSON.stringify({
            today: new Date().toISOString().slice(0, 10),
            products,
            pathologists,
            medicines: prescription.medicines,
        })

        const MEDICINE_FOUNDER_PROMPT = `You are a medicine and pathology-test availability checker for a healthcare platform.

You will receive THREE pieces of data in JSON:
1. "products" — the pharmacy's inventory (id, name, description, price, stock, expiresOn, isActive)
2. "pathologists" — labs/diagnostic centers with their specializations and fees
3. "medicines" — a list of medicines extracted via OCR from a doctor's prescription (name, dosage, frequency, duration, notes)

YOUR TASK:
For each entry in "medicines", determine whether it is available in "products" using fuzzy/partial name matching (OCR text is often noisy — e.g. "O-claram-625" may match "Amoxyclav 625" or similar; match on best semantic/brand similarity, not exact string equality). Only mark a product as available if isActive is true, stock > 0, and it is not expired (compare expiresOn to the "today" date in the data).

If any prescription line looks like a lab test / diagnostic order rather than a medicine (e.g. "CBC", "CT Scan", "Blood Sugar"), match it against pathologists' "specialization" arrays instead, and list which labs offer it, their consultationFee, and availableDays/workingHours.

OUTPUT FORMAT — return ONLY valid JSON, no preamble, no markdown fences:

{
  "medicines": [
    {
      "prescribed_name": "<name as it appeared on prescription>",
      "matched_product_name": "<name from products, or null if no match found>",
      "match_confidence": "high" | "medium" | "low" | "none",
      "available": true | false,
      "reason": "<short reason, e.g. 'in stock, active' / 'out of stock' / 'expired' / 'no matching product found'>",
      "price": <number or null>,
      "stock": <number or null>,
      "dosage": "<from prescription, if any>",
      "duration": "<from prescription, if any>"
    }
  ],
  "tests": [
    {
      "prescribed_test": "<test name as extracted>",
      "available_labs": [
        {
          "laboratoryName": "<string>",
          "laboratoryAddress": "<string>",
          "consultationFee": <number>,
          "availableDays": [<strings>],
          "workingHours": { "start": "<string>", "end": "<string>" }
        }
      ]
    }
  ],
  "summary": {
    "total_medicines_prescribed": <number>,
    "medicines_available": <number>,
    "medicines_unavailable": <number>,
    "tests_prescribed": <number>,
    "tests_with_available_labs": <number>
  }
}

RULES:
- Never invent a product, price, or lab that isn't in the provided data.
- If a prescription entry's "notes" says it's crossed out or unclear, still attempt a match but flag match_confidence as "low" and add a note.
- Be conservative: if you're not reasonably confident of a match, set matched_product_name to null and available to false rather than guessing.
- Do not include any explanation outside the JSON object.

Here is the data: ${data}
`

        const response = await generateContent({
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: MEDICINE_FOUNDER_PROMPT },
                    ],
                },
            ],
            config: {
                responseMimeType: "application/json",
            },
        });

        const parsed = parseJson(response.text);

        res.json(parsed)

    } catch (error) {
        console.error(error);
        const busy = isTransientError(String(error?.message || ""));
        res.status(busy ? 503 : 502).json({ error: "Error In Getting Data From Server!", details: describeAiError(error) })
    }
}


const chatWithAi = async (req, res) => {

    const { text } = req.body || {}

    if (!text || !text.trim()) {
        return res.status(400).json({ error: "Please provide a message" })
    }

    const SYSTEM_INSTRUCTION = `You are MediTrust's basic health guidance assistant. Rules you MUST follow:
- Give only general, non-diagnostic health information.
- Never provide a diagnosis and never recommend specific dosages.
- Never recommend specific prescription medicine names.
- Keep answers short and easy to understand (max 150 words).
- Always suggest booking a real doctor on MediTrust for anything specific or urgent.
- If the question is an emergency or serious symptom, urge seeking immediate professional care. here is my query : ${text}`

    try {
        const response = await generateContent({
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: SYSTEM_INSTRUCTION },
                    ],
                },
            ],
        });

        res.json({ reply: response.text })

    } catch (error) {
        console.log(error.message)
        const busy = isTransientError(String(error?.message || ""));
        res.status(busy ? 503 : 502).json({ error: "Error In Getting Data From Server!", details: describeAiError(error) })
    }
}


const aiController = {
    explainPrescription, findMedicines, chatWithAi
}

export default aiController
