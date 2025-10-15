import express from "express";
import upload from "../middleware/upload.js";
import {  updateRecruiter, getRecruiter, recruiterCompanyRegister, recruiterRegister, getRecruiterCompany, recruiterLogin, recruiterCompanies } from "../controllers/recruiterControllers.js";

const router = express.Router();

router.post("/register", recruiterRegister);
router.post("/company", upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "banner", maxCount: 1 },
]), recruiterCompanyRegister);
router.get("/:userId", getRecruiter)
router.patch("/update-user",updateRecruiter);
router.post('/login',  recruiterLogin )
router.get ("/getemployercompany", getRecruiterCompany)
router.get("/:userId/companies",recruiterCompanies)
export default router;