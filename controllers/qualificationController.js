import pool from "../config/db.js";

export const getQualifications = async (req, res) => {
  try {
    const sql = 'SELECT * FROM qualifications ORDER BY category, subcategory';
    const [rows] = await pool.query(sql); 
    res.json(rows);
  } catch (error) {
    console.error("getQualifications error:", error.message);
    res.status(500).json({ error: "Failed to fetch qualifications", details: error.message });
  }
};

export const getQualificationSubcategories = async (req, res) => {
  try {
    const { category_id } = req.params;
    const categorySql = 'SELECT category FROM qualifications WHERE id = ?';
    const [categoryRows] = await pool.query(categorySql, [category_id]);

    if (categoryRows.length === 0) {
      return res.status(404).json({ error: 'Qualification category not found' });
    }

    const categoryName = categoryRows[0].category;
    const sql = 'SELECT * FROM qualifications WHERE category = ? AND subcategory IS NOT NULL ORDER BY subcategory';
    const [rows] = await pool.query(sql, [categoryName]);
    res.json(rows);
  } catch (error) {
    console.error('getQualificationSubcategories error:', error.message);
    res.status(500).json({ error: 'Failed to fetch subcategories', details: error.message });
  }
};