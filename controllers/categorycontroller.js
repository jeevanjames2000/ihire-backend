import pool from "../config/db.js";
export const getAllCategories = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.id, 
        c.industry_id, 
        c.name, 
        COUNT(j.id) AS job_count
      FROM categories c
      INNER JOIN jobs j ON c.id = j.category_id
      GROUP BY c.id, c.industry_id, c.name
      HAVING job_count > 0
      ORDER BY c.name ASC
    `);

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      error: "Failed to fetch categories",
      details: error.message,
    });
  }
};

export const getJobsByCategorySlug = async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const city = req.query.city || "";
    const categoryName = categorySlug.replace(/-/g, " ");
    const [jobs] = await pool.query(
      `SELECT 
          j.id, 
          j.title, 
          j.location, 
          j.salary_min, 
          j.salary_max, 
          j.employment_type, 
          j.description,
          c.name AS category
       FROM jobs j
       JOIN categories c ON j.category_id = c.id
       WHERE LOWER(c.name) = LOWER(?)
       ${city ? "AND LOWER(j.location) LIKE LOWER(?)" : ""}`,
      city ? [categoryName, `%${city}%`] : [categoryName]
    );
    res.status(200).json(jobs);
  } catch (err) {
    console.error("Error fetching jobs:", err);
    res.status(500).json({ error: "Failed to fetch jobs", details: err.message });
  }
};
