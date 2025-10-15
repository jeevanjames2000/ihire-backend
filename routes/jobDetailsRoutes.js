import express from "express";
import { createJob, deleteJob, getAllJobs,getAllJobsFilter,getJobById, updateJob } from "../controllers/jobDetailsController.js";
const router = express.Router();

router.post("/createJob",createJob)
router.get("/getAllJobs",getAllJobs)
router.get('/getJobById/:id', getJobById);
router.post('/all', getAllJobsFilter);             
router.put('/:id', updateJob);        
router.delete('/:id', deleteJob);     

export default router;