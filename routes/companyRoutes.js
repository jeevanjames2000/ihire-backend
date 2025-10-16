import express from "express";
import {
  getAllCompanies,
  getCompanyById,
  getCompanyOpenings,
} from "../controllers/companiesController.js";

const router = express.Router();

router.get("/getAllCompanies", getAllCompanies);
router.get("/getCompanyById", getCompanyById);
router.get("/getCompanyOpenings", getCompanyOpenings);
export default router;
