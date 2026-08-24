const registerUser=async(req,res)=>{
    res.send("User Registered")
}

const loginUser=async(req,res)=>{
    res.send("User LOGGED IN....")
}


const authService={
    registerUser,
    loginUser
}

export default authService