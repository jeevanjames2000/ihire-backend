import pool from "../config/db.js";
import authenticate, { getTokenPayload } from "../middleware/auth.js";


export const createJob = async (req, res) => {
  const form = req.body;

  if (!form.company_id) return res.status(400).json({ message: 'company_id required' });
  if (!form.title) return res.status(400).json({ message: 'title required' });
  if (!form.description || !form.description.trim()) return res.status(400).json({ message: 'description required' });
  if (!form.responsibilities || !form.responsibilities.trim()) return res.status(400).json({ message: 'responsibilities required' });
  if (!form.qualification_category_id) return res.status(400).json({ message: 'qualification_category_id required' });
  if (!form.qualification_subcategory_id) return res.status(400).json({ message: 'qualification_subcategory_id required' });

  try {
    const [result] = await pool.query(
      `INSERT INTO jobs (
        company_id, title, role, location, employment_type,
        experience_min, experience_max, salary_min, salary_max, hide_salary,
        vacancies, education, industry, responsibilities, qualifications,
        description, skills, labels, questions, walkin_details,
        created_by, qualification_category_id, qualification_subcategory_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        form.company_id,
        form.title,
        form.role || null,
        form.location || null,
        form.employment_type || null,
        form.experience_min || null,
        form.experience_max || null,
        form.salary_min || null,
        form.salary_max || null,
        form.hide_salary ? 1 : 0,
        form.vacancies || 1,
        form.education || null,
        form.industry || null,
        form.responsibilities || null,
        form.qualifications || null,
        form.description || '',
        JSON.stringify(form.skills || []),
        JSON.stringify(form.labels || []),
        JSON.stringify(form.questions || []),
        JSON.stringify(form.walkin_details || null),
        req.user?.userId || "2",
        form.qualification_category_id || null,
        form.qualification_subcategory_id || null
      ]
    );

    res.status(201).json({ message: 'Job created successfully', jobId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating job' });
  }
};


export const getAllJobs = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        j.id,
        j.title,
        c.name AS company,
        COALESCE(c.logo_url, '/uploads/logos/default-logo.png') AS logo, -- Fetch logo_url from companies
        j.location,
        CONCAT('$', FORMAT(j.salary_min, 0), '-$', FORMAT(j.salary_max, 0)) AS salary,
        j.employment_type AS type,
        JSON_UNQUOTE(j.description) AS description -- Parse JSON description
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      ORDER BY j.created_at DESC
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ message: "Error fetching jobs", error: error.message });
  }
}
export const getJobById = async (req, res) => {
  try {
    const { id } = req.params;

   const [rows] = await pool.query(`
  SELECT 
    j.id,
    j.title,
    c.name AS company,
    COALESCE(c.logo_url, '/uploads/logos/default-logo.png') AS logo,
    j.location,
    CONCAT('$', FORMAT(j.salary_min, 0), '-$', FORMAT(j.salary_max, 0)) AS salary,
    j.employment_type AS type,
    JSON_UNQUOTE(j.description) AS description,
    j.responsibilities,
    j.education,
    j.qualification_category,
    j.qualification_subcategory,
    COALESCE(i.name, 'General') AS category
  FROM jobs j
  LEFT JOIN companies c ON j.company_id = c.id
  LEFT JOIN industries i ON j.industry_id = i.id
  WHERE j.id = ?
`, [id]);


    if (rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }

    const job = {
      ...rows[0],
      responsibilities: rows[0].responsibilities || '',
      qualifications: rows[0].qualifications || '',
      description: rows[0].description ? JSON.parse(rows[0].description).html || '' : '',
    };

    res.status(200).json(job);
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ message: "Error fetching job", error: error.message });
  }
};

const SORT_FIELD_MAP = {
  createdAt: 'j.created_at',
  title: 'j.title',
  salaryMin: 'j.salary_min',
  salaryMax: 'j.salary_max',
  experienceMin: 'j.experience_min',
  experienceMax: 'j.experience_max'
};

export const getAllJobsFilter = async (req, res) => {
   try {
    const { page = 1, jobsPerPage = 50 } = req.body || {};
    const limit = Math.min(Number(jobsPerPage) || 50, 200);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
    const [rows] = await pool.query('SELECT *  FROM jobs WHERE company_id = ? LIMIT ? OFFSET ?', [1, limit, offset]);
    return res.status(200).json({ jobs: rows, total: rows.length, page: Number(page), jobsPerPage: limit });
  } catch (err) {
    console.error('all-no-filter error', err);
    return res.status(500).json({ message: err.message });
  }
};


export const updateJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const token =authenticate(req.headers.authorization);
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const [existingRows] = await pool.query('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!existingRows.length) return res.status(404).json({ message: 'Job not found' });

    const existing = existingRows[0];
    if (token.role !== 'admin' && token.company_id !== existing.company_id && token.id !== existing.created_by) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const body = req.body || {};
    const updatable = [
      'title','role','function_area','location','employment_type',
      'experience_min','experience_max','salary_min','salary_max','hide_salary',
      'vacancies','education','responsibilities','description','skills','labels',
      'questions','walkin_details','receive_matching_email','share_with_subusers',
      'industry_id','category_id','subcategory_id','qualification_category',
      'qualification_subcategory','status','deadline','company_name'
    ];

    const setClauses = [];
    const params = [];

    updatable.forEach(field => {
      if (body[field] !== undefined) {
        let value = body[field];
        if (['description', 'skills', 'labels', 'questions', 'walkin_details'].includes(field) && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        setClauses.push(`${field} = ?`);
        params.push(value);
      }
    });

    if (!setClauses.length) {
      return res.status(400).json({ message: 'No updatable fields provided' });
    }

    setClauses.push('updated_at = NOW()');
    params.push(jobId);

    await pool.query(`UPDATE jobs SET ${setClauses.join(', ')} WHERE id = ?`, params);
    const [updatedRows] = await pool.query('SELECT * FROM jobs WHERE id = ?', [jobId]);
    res.json(updatedRows[0]);
  } catch (err) {
    console.error('updateJob error:', err);
    res.status(500).json({ message: 'Server error while updating job' });
  }
};


export const deleteJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const token = authenticate(req.headers.authorization);
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const [rows] = await pool.query('SELECT company_id, created_by FROM jobs WHERE id = ?', [jobId]);
    if (!rows.length) return res.status(404).json({ message: 'Job not found' });

    const job = rows[0];
    if (token.role !== 'admin' && token.company_id !== job.company_id && token.id !== job.created_by) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await pool.query('DELETE FROM jobs WHERE id = ?', [jobId]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteJob error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
