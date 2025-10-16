import express from "express"
import { deleteSavedjob, getSavedJobs, saveJobs, userLogin, userProfile, userProfileUpdate, userRegister} from "../controllers/userController.js"
import authenticate from "../middleware/auth.js"
 const router=express.Router()

 router.post("/register",userRegister)
 router.post("/login",userLogin)
 router.post("/logout",userLogin)
 router.get("/profile/:id",userProfile)
 router.put("/updateUserProfile/:id",userProfileUpdate)
router.get ("/saveJobs",getSavedJobs)
router.post("/saveJobs/:id",authenticate, saveJobs)
router.delete("/delete/savedJobs",authenticate,deleteSavedjob)
 export default router