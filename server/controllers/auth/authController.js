import User from "../../models/userModel.js"
import bcrypt from "bcryptjs"

const registerUser=async(req,res)=>{

    const {name,email,phone,password}=req.body

    //Check if all required fields are entered
    if(!name || !email || !phone || !password){
        res.status(409)
        throw new Error("Please Fill all required details....")
    }
    
      

    const emailExist=await User.findOne({email})
    const phoneExist=await User.findOne({phone})

    //Check if user already exists
    if(emailExist || phoneExist){
        res.status(409)
        throw new Error("User Already exists..")
    }

    //Hashing the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt)

    const user= await User.create({name,email,phone,password:hashedPassword})

    if(!user){
        res.status(409)
        throw new Error("User not Registered")
    }

    res.status(201).json(user)

 
}

const loginUser=async(req,res)=>{

     const {email,password}=req.body

    //Check if all required fields are entered
    if( !email || !password){
        res.status(409)
        throw new Error("Please Fill all required details....")
    }

    //Check if user already exists
    const user=await User.findOne({email})

    if(user && await bcrypt.compare(password, user.password)){
        res.status(200).json(user)
    }else{
        res.status(409)
        throw new Error("Invalid Credentials...")
    }


    
      
  

    res.send("User LOGGED IN....")
}




const authService={
    registerUser,
    loginUser
}

export default authService