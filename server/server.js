import express from "express"
import dotenv from "dotenv"
import colors from "colors"
import connectDb from "./config/dbConfig.js"


dotenv.config()

const PORT= process.env.PORT || 5000

import authRoutes from "./routes/authRoutes.js"





const app=express()

app.listen(PORT,()=>{
    console.log(`SERVER IS RUNNIGN AT PORT ${PORT}`.bgBlue)
})

//DB CONNECTION

connectDb()

//BODY PARSER

app.use(express.json())
app.use(express.urlencoded())


//AUTH ROUTES

app.use("/api/auth",authRoutes)

