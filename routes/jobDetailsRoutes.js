import express from "express";
import {
  createJob,
  deleteJob,
  getAllJobs,
  getAllJobsFilter,
  getJobById,
  updateJob,
  jobDynamicForm,
  getJobDynamicForm,
  createAndSubmitApplication,
  getApplicationResponses,
  getApplicationsByJob,
} from "../controllers/jobDetailsController.js";
import fs from "fs";
import path from "path";
import multer from "multer";
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/msword" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, and DOCX files are allowed"), false);
    }
  },
});
const router = express.Router();
router.post("/createJob", createJob);
router.get("/getAllJobs", getAllJobs);
router.get("/getJobById", getJobById);
router.post("/all", getAllJobsFilter);
router.put('/updatejob/:id', updateJob);        
router.delete('/deletejobs/:id', deleteJob);
router.post("/createDynamicForm", jobDynamicForm);
router.get("/getJobDynamicForm", getJobDynamicForm);
router.post(
  "/createAndSubmitApplication",
  upload.any(),
  createAndSubmitApplication
);
router.get("/getApplicationResponses", getApplicationResponses);
router.get("/getApplicationsByJob", getApplicationsByJob);

export default router;
