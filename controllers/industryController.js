import pool from "../config/db.js";


export const getIndustries = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM industries ORDER BY name");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch industries" });
  }
};

export const getCategoriesByIndustry = async (req, res) => {
  try {
    const industryId = req.params.industryId;
    const [rows] = await pool.query(
      "SELECT * FROM categories WHERE industry_id = ? ORDER BY name",
      [industryId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};


export const getSubcategoriesByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const [rows] = await pool.query(
      "SELECT * FROM subcategories WHERE id = ? ORDER BY name",
      [categoryId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch subcategories" });
  }
};
