import express from "express";
import { getQualifications, getQualificationSubcategories }  from "../controllers/qualificationController.js";

const router = express.Router();
router.get("/", getQualifications);
router.get('/:category_id/subcategories', getQualificationSubcategories);
export default router;
