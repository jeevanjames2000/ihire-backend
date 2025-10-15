import express from "express";
import { getAllCategories ,getJobsByCategorySlug} from "../controllers/categorycontroller.js"; 

const router = express.Router();

router.get("/", getAllCategories);
router.get("/:categorySlug", getJobsByCategorySlug);

export default router;
