import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import upload from "../middleware/upload.js";

const validateUser = (body) => {
  const { name, email, password, designation } = body;
  if (!name || typeof name !== "string" || name.trim() === "") {
    return "Name is required";
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Valid email is required";
  }
  if (!password || password.length < 6) {
    return "Password must be at least 6 characters";
  }
  if (
    !designation ||
    typeof designation !== "string" ||
    designation.trim() === ""
  ) {
    return "Designation is required";
  }
  return null;
};

const validateCompany = (body) => {
  const { userId, name } = body;
  const parsedUserId = Number(userId);
  if (!userId || isNaN(parsedUserId)) {
    return "Valid userId is required";
  }
  if (!name || typeof name !== "string" || name.trim() === "") {
    return "Company name is required";
  }
  if (body.website && !/^https?:\/\/.+/.test(body.website)) {
    return "Valid website URL is required";
  }
  if (body.video_url && !/^https?:\/\/.+/.test(body.video_url)) {
    return "Valid video URL is required";
  }
  if (body.size && !["1-10", "11-50", "51-200", "200+"].includes(body.size)) {
    return "Invalid company size";
  }
  return null;
};

export const recruiterRegister = async (req, res) => {
  let connection;
  try {
    const error = validateUser(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const { name, email, password, designation } = req.body;
    connection = await pool.getConnection();

    const [existingUser] = await connection.query(
      "SELECT * FROM recruiters WHERE email = ?",
      [email]
    );
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await connection.query(
      "INSERT INTO recruiters (name, email, password, designation) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, designation]
    );

    const userId = result.insertId;
    const [userRows] = await connection.query(
      "SELECT * FROM recruiters WHERE id = ?",
      [userId]
    );
    const user = userRows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Recruiter registered successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        designation: user.designation,
      },
      token,
    });
  } catch (error) {
    console.error("Recruiter register error:", error);
    res
      .status(500)
      .json({ error: "Something went wrong", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};

export const recruiterCompanyRegister = [
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  async (req, res) => {
    let connection;
    try {
      const error = validateCompany(req.body);
      if (error) {
        return res.status(400).json({ error });
      }

      const {
        userId,
        name,
        description,
        website,
        video_url,
        location,
        pincode,
        state,
        industry,
        size,
        established_year,
      } = req.body;
      const parsedUserId = Number(userId);
      connection = await pool.getConnection();

      const [user] = await connection.query(
        "SELECT * FROM recruiters WHERE id = ?",
        [parsedUserId]
      );
      if (user.length === 0) {
        return res.status(400).json({ error: "Invalid user" });
      }

      let logo_url = null;
      let banner_url = null;
      if (req.files?.logo) {
        logo_url = `/uploads/logos/${req.files.logo[0].filename}`;
      }
      if (req.files?.banner) {
        banner_url = `/uploads/banners/${req.files.banner[0].filename}`;
      }

      const [existingCompany] = await connection.query(
        "SELECT * FROM companies WHERE created_by = ?",
        [parsedUserId]
      );

      let companyId;

      if (existingCompany.length > 0) {
        await connection.query(
          `UPDATE companies SET 
            name = ?, description = ?, website = ?, logo_url = ?, 
            banner_url = ?, video_url = ?, location = ?, pincode = ?, 
            state = ?, industry = ?, size = ?, established_year = ?
           WHERE created_by = ?`,
          [
            name,
            description || null,
            website || null,
            logo_url || existingCompany[0].logo_url,
            banner_url || existingCompany[0].banner_url,
            video_url || null,
            location || null,
            pincode || null,
            state || null,
            industry || null,
            size || null,
            established_year || null,
            parsedUserId,
          ]
        );

        companyId = existingCompany[0].id;
      } else {
        const [insertResult] = await connection.query(
          `INSERT INTO companies (
             created_by, name, description, website, logo_url, 
             banner_url, video_url, location, pincode, state, 
             industry, size, established_year
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            parsedUserId,
            name,
            description || null,
            website || null,
            logo_url,
            banner_url,
            video_url || null,
            location || null,
            pincode || null,
            state || null,
            industry || null,
            size || null,
            established_year || null,
          ]
        );

        companyId = insertResult.insertId;
      }

      if (companyId) {
        await connection.query(
          "UPDATE recruiters SET company_id = ? WHERE id = ?",
          [companyId, parsedUserId]
        );
      }

      const [companyRows] = await connection.query(
        "SELECT id, name, description, website, logo_url, banner_url, location, pincode, state, industry, size, established_year FROM companies WHERE id = ? LIMIT 1",
        [companyId]
      );
      let company = companyRows && companyRows.length ? companyRows[0] : null;

     
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.get("host");
      const baseUrl = `${protocol}://${host}`;

      if (company) {
        if (company.logo_url && !company.logo_url.startsWith("http")) {
          company.logo_url = `${baseUrl}${company.logo_url}`;
        }
        if (company.banner_url && !company.banner_url.startsWith("http")) {
          company.banner_url = `${baseUrl}${company.banner_url}`;
        }
      }
     const token = jwt.sign(
        { userId: parsedUserId, role: user[0].role || "recruiter", company_id: companyId },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      res.status(200).json({
        message: "Company details saved successfully",
        companyId,
        company,
        token, 
      });
    } catch (error) {
      console.error("Company register error:", error);
      res
        .status(500)
        .json({ error: "Something went wrong", details: error.message });
    } finally {
      if (connection) connection.release();
    }
  },
];


export const getRecruiter = async (req, res) => {
  let connection;
  try {
    const { userId } = req.params;
    connection = await pool.getConnection();

    const [user] = await connection.query(
      "SELECT name, email, designation FROM recruiters WHERE id = ?",
      [userId]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user[0]);
  } catch (error) {
    console.error("Get recruiter error:", error);
    res
      .status(500)
      .json({ error: "Something went wrong", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};
  
export const updateRecruiter = async (req, res) => {
  let connection;
  try {
    const error = validateUser(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const { userId, name, password, designation } = req.body;
    connection = await pool.getConnection();

    const [user] = await connection.query(
      "SELECT * FROM recruiters WHERE id = ?",
      [userId]
    );
    if (user.length === 0) {
      return res.status(400).json({ error: "Invalid user" });
    }

    const [existingEmail] = await connection.query(
      "SELECT * FROM recruiters WHERE  id != ?",
      [userId]
    );
    if (existingEmail.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const updates = { name, designation };
    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }

    await connection.query(
      "UPDATE recruiters SET name = ?, password = ?, designation = ? WHERE id = ?",
      [
        updates.name,
        updates.password || user[0].password,
        updates.designation,
        userId,
      ]
    );

    res.status(200).json({ message: "Recruiters details updated" });
  } catch (error) {
    console.error("User update error:", error);
    res
      .status(500)
      .json({ error: "Something went wrong", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};

export const getRecruiterCompany = async (req, res) => {
  let connection;
  try {
    const { userId } = req.params;

    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ error: 'Valid userId is required' });
    }

    connection = await pool.getConnection();

  
    const [recruiterRows] = await connection.query(
      'SELECT id, name, email, designation, company_id FROM recruiters WHERE id = ?',
      [Number(userId)]
    );

    if (recruiterRows.length === 0) {
      return res.status(404).json({ error: 'Recruiter not found' });
    }

    const recruiter = recruiterRows[0];

  
    const [companyRows] = await connection.query(
      `SELECT id, created_by, name, description, website, logo_url, banner_url, video_url,
              location, pincode, state, industry, size, established_year, created_at, updated_at
       FROM companies
       WHERE created_by = ? LIMIT 1`,
      [Number(userId)]
    );

    const company = companyRows.length ? companyRows[0] : null;

    return res.status(200).json({ recruiter, company });
  } catch (error) {
    console.error('Get recruiter company error:', error);
    return res.status(500).json({ error: 'Something went wrong', details: error.message });
  } finally {
    if (connection) connection.release();
  
  }
};

export const recruiterLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email, password);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, password, role, company_id FROM recruiters WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, company_id:user?.company_id  },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1d' }
    );

    let company = null;
    if (user.company_id) {
      try {
        const [compRows] = await pool.query(
          `SELECT id, created_by, name, description, website, logo_url, banner_url, video_url,
                  location, pincode, state, industry, size, established_year
           FROM companies WHERE id = ? LIMIT 1`,
          [user.company_id]
        );
        if (compRows.length) company = compRows[0];
      } catch (err) {
  
        console.error('Failed to fetch company for login response:', err);
      }
    }

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name || user.full_name || null,
        email: user.email,
        role: user.role,
        company_id: user.company_id || null,
      },
      company 
    });
  } catch (err) {
    console.error('Error in RecruiterLogin:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }}


  export const recruiterCompanies=async(req,res)=>{
     const { userId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.name 
       FROM recruiters r
       JOIN companies c ON r.company_id = c.id
       WHERE r.created_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No companies found for this recruiter' });
    }

    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ message: 'Error fetching companies' });
  }
  }