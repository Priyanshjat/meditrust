import mongoose from "mongoose"

const connectDb=async()=>{
    try {
        const conn= await mongoose.connect(process.env.MONGO_URI)
        console.log(`DB CONNECTION SUCCESSFULL : ${conn.connection.name}`.bgGreen)
    } catch (error) {
        console.log(`DB CONNECTION FAILED ${error.message}`)
    }
}

export default connectDb