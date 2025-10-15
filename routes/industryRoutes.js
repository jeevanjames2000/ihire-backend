import express from "express";
import { getCategoriesByIndustry, getIndustries, getSubcategoriesByCategory } from "../controllers/industryController.js";


const router = express.Router();


router.get("/", getIndustries);
router.get("/:industryId/categories", getCategoriesByIndustry);
router.get("/categories/:categoryId/subcategories", getSubcategoriesByCategory);

export default router;
