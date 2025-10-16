import pool from "../config/db.js";

export const getAllCompanies = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM companies LIMIT 5");
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching companies:", error);
    res
      .status(500)
      .json({ message: "Error fetching companies", error: error.message });
  }
};
export const getCompanyById = async (req, res) => {
  const { companyId } = req.query;
  try {
    const [rows] = await pool.query("SELECT * FROM companies WHERE id = ?", [
      companyId,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching company:", error);
    res
      .status(500)
      .json({ message: "Error fetching company", error: error.message });
  }
};

export const getCompanyOpenings = async (req, res) => {
  const { companyId } = req.query;

  try {
    let query = "SELECT * FROM jobs";
    let params = [];

    if (companyId) {
      query += " WHERE company_id = ?";
      params.push(companyId);
    }

    query += " ORDER BY created_at DESC";

    const [rows] = await pool.query(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching company openings:", error);
    res.status(500).json({
      message: "Error fetching company openings",
      error: error.message,
    });
  }
};
