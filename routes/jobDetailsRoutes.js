import express from "express";
import { createJob, deleteJob, getAllJobs,getAllJobsFilter,getJobById, getJobs, updateJob } from "../controllers/jobDetailsController.js";
const router = express.Router();

router.post("/createJob",createJob);
router.get("/getAllJobs",getAllJobs);
router.get('/getJobById/:id', getJobById);
router.post('/all', getAllJobsFilter);             
router.put('/updatejob/:id', updateJob);        
router.delete('/deletejobs/:id', deleteJob);
  

export default router;