import axios from "axios"


const authHeaders = (token) => ({
    headers: {
        authorization: `Bearer ${token}`
    }
})

// Uploads a prescription image/PDF and returns the saved prescription
// (patient_name, doctor_name, date, medicines[], diagnosis_notes, image)
const explainPrescription = async ({ file, token }) => {
    const formData = new FormData()
    formData.append("prescription", file)

    // NOTE: don't set Content-Type manually — the browser adds the
    // multipart boundary automatically.
    const response = await axios.post("/api/ai/prescription", formData, authHeaders(token))
    return response.data
}

// Checks a saved prescription against pharmacy inventory and labs
const findMedicines = async ({ prescriptionId, token }) => {
    const response = await axios.get(`/api/ai/find/${prescriptionId}`, authHeaders(token))
    return response.data
}

// Sends a chat message and returns { reply }
const chatWithAi = async ({ text, token }) => {
    const response = await axios.post("/api/ai/chat", { text }, authHeaders(token))
    return response.data
}


const aiService = { explainPrescription, findMedicines, chatWithAi }

export default aiService
