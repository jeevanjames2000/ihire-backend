import pool from "../config/db.js";
import authenticate from "../middleware/auth.js";
export const createJob = async (req, res) => {
  const form = req.body;
  if (!form.company_id)
    return res.status(400).json({ message: "company_id required" });
  if (!form.title) return res.status(400).json({ message: "title required" });
  if (!form.description || !form.description.trim())
    return res.status(400).json({ message: "description required" });
  if (!form.responsibilities || !form.responsibilities.trim())
    return res.status(400).json({ message: "responsibilities required" });
  if (!form.qualification_category_id)
    return res
      .status(400)
      .json({ message: "qualification_category_id required" });
  if (!form.qualification_subcategory_id)
    return res
      .status(400)
      .json({ message: "qualification_subcategory_id required" });
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
        form.description || "",
        JSON.stringify(form.skills || []),
        JSON.stringify(form.labels || []),
        JSON.stringify(form.questions || []),
        JSON.stringify(form.walkin_details || null),
        req.user?.userId || "2",
        form.qualification_category_id || null,
        form.qualification_subcategory_id || null,
      ]
    );
    res
      .status(201)
      .json({ message: "Job created successfully", jobId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating job" });
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
    res
      .status(500)
      .json({ message: "Error fetching jobs", error: error.message });
  }
};
export const getJobById = async (req, res) => {
  try {
    const { id } = req.query;
    const [rows] = await pool.query(
      `
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
`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }
    const job = {
      ...rows[0],
      responsibilities: rows[0].responsibilities || "",
      qualifications: rows[0].qualifications || "",
      description: rows[0].description
        ? JSON.parse(rows[0].description).html || ""
        : "",
    };
    res.status(200).json(job);
  } catch (error) {
    console.error("Error fetching job:", error);
    res
      .status(500)
      .json({ message: "Error fetching job", error: error.message });
  }
};
const SORT_FIELD_MAP = {
  createdAt: "j.created_at",
  title: "j.title",
  salaryMin: "j.salary_min",
  salaryMax: "j.salary_max",
  experienceMin: "j.experience_min",
  experienceMax: "j.experience_max",
};
export const getAllJobsFilter = async (req, res) => {
  try {
    const { page = 1, jobsPerPage = 50 } = req.body || {};
    const limit = Math.min(Number(jobsPerPage) || 50, 200);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
    const [rows] = await pool.query(
      "SELECT *  FROM jobs WHERE company_id = ? LIMIT ? OFFSET ?",
      [1, limit, offset]
    );
    return res.status(200).json({
      jobs: rows,
      total: rows.length,
      page: Number(page),
      jobsPerPage: limit,
    });
  } catch (err) {
    console.error("all-no-filter error", err);
    return res.status(500).json({ message: err.message });
  }
};
export const updateJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const token = authenticate(req.headers.authorization);
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const [existingRows] = await pool.query("SELECT * FROM jobs WHERE id = ?", [
      jobId,
    ]);
    if (!existingRows.length)
      return res.status(404).json({ message: "Job not found" });
    const existing = existingRows[0];
    if (
      token.role !== "admin" &&
      token.company_id !== existing.company_id &&
      token.id !== existing.created_by
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const body = req.body || {};
    const updatable = [
      "title",
      "role",
      "function_area",
      "location",
      "employment_type",
      "experience_min",
      "experience_max",
      "salary_min",
      "salary_max",
      "hide_salary",
      "vacancies",
      "education",
      "responsibilities",
      "description",
      "skills",
      "labels",
      "questions",
      "walkin_details",
      "receive_matching_email",
      "share_with_subusers",
      "industry_id",
      "category_id",
      "subcategory_id",
      "qualification_category",
      "qualification_subcategory",
      "status",
      "deadline",
      "company_name",
    ];
    const setClauses = [];
    const params = [];
    updatable.forEach((field) => {
      if (body[field] !== undefined) {
        let value = body[field];
        if (
          [
            "description",
            "skills",
            "labels",
            "questions",
            "walkin_details",
          ].includes(field) &&
          typeof value === "object"
        ) {
          value = JSON.stringify(value);
        }
        setClauses.push(`${field} = ?`);
        params.push(value);
      }
    });
    if (!setClauses.length) {
      return res.status(400).json({ message: "No updatable fields provided" });
    }
    setClauses.push("updated_at = NOW()");
    params.push(jobId);
    await pool.query(
      `UPDATE jobs SET ${setClauses.join(", ")} WHERE id = ?`,
      params
    );
    const [updatedRows] = await pool.query("SELECT * FROM jobs WHERE id = ?", [
      jobId,
    ]);
    res.json(updatedRows[0]);
  } catch (err) {
    console.error("updateJob error:", err);
    res.status(500).json({ message: "Server error while updating job" });
  }
};
export const deleteJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const token = authenticate(req.headers.authorization);
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const [rows] = await pool.query(
      "SELECT company_id, created_by FROM jobs WHERE id = ?",
      [jobId]
    );
    if (!rows.length) return res.status(404).json({ message: "Job not found" });
    const job = rows[0];
    if (
      token.role !== "admin" &&
      token.company_id !== job.company_id &&
      token.id !== job.created_by
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await pool.query("DELETE FROM jobs WHERE id = ?", [jobId]);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("deleteJob error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
export const createAndSubmitApplication = async (req, res) => {
  try {
    const { job_id, candidate_id, responses } = req.body;
    if (!job_id) {
      return res.status(400).json({ message: "job_id required" });
    }
    if (!responses) {
      return res.status(400).json({ message: "responses is required" });
    }
    const parsedResponses =
      typeof responses === "string" ? JSON.parse(responses) : responses;
    if (!Array.isArray(parsedResponses) || parsedResponses.length === 0) {
      return res.status(400).json({ message: "responses array is required" });
    }
    const [appResult] = await pool.query(
      `INSERT INTO job_applications (job_id, candidate_id, applied_at) VALUES (?, ?, NOW())`,
      [job_id, candidate_id]
    );
    const application_id = appResult.insertId;
    const insertPromises = parsedResponses.map(async (resp, index) => {
      const { field_id, field_value, field_type } = resp;
      if (!field_id || field_value === undefined) {
        throw new Error(`Invalid response at index ${index}`);
      }
      let finalValue = field_value;
      if (field_type === "file") {
        const fileFieldName = `file_${field_id}`;
        const uploadedFile = req.files?.find(
          (file) => file.fieldname === fileFieldName
        );
        if (uploadedFile) {
          finalValue = JSON.stringify({
            filename: uploadedFile.originalname,
            mimetype: uploadedFile.mimetype,
            size: uploadedFile.size,
            path: uploadedFile.path,
          });
        } else {
          finalValue = JSON.stringify({ filename: field_value });
        }
      } else if (Array.isArray(field_value)) {
        finalValue = JSON.stringify(field_value);
      } else if (
        typeof field_value === "string" &&
        field_value.startsWith("[") &&
        field_value.endsWith("]")
      ) {
        try {
          const parsed = JSON.parse(field_value);
          if (Array.isArray(parsed)) {
            finalValue = JSON.stringify(parsed);
          } else {
            finalValue = field_value;
          }
        } catch {
          finalValue = field_value;
        }
      } else if (typeof field_value === "object" && field_value !== null) {
        finalValue = JSON.stringify(field_value);
      }
      return pool.query(
        `INSERT INTO job_application_responses
         (application_id, job_id, field_id, field_value)
         VALUES (?, ?, ?, ?)`,
        [application_id, job_id, field_id, finalValue]
      );
    });
    await Promise.all(insertPromises);
    res.status(201).json({
      message: "Application submitted successfully",
      application_id,
      total_responses: parsedResponses.length,
    });
  } catch (err) {
    console.error("Error creating/submitting application:", err);
    res.status(500).json({
      message: "Error creating/submitting application",
      error: err.message,
    });
  }
};
export const jobDynamicForm = async (req, res) => {
  try {
    const { job_id, form_fields } = req.body;
    if (!job_id) {
      return res.status(400).json({ message: "job_id is required" });
    }
    if (!Array.isArray(form_fields) || form_fields.length === 0) {
      return res.status(400).json({ message: "form_fields array required" });
    }
    const insertPromises = form_fields.map(async (field, index) => {
      const {
        field_label,
        field_type,
        is_required = true,
        field_options = [],
        is_multi = false,
      } = field;
      if (!field_label || !field_type) {
        throw new Error(`Invalid field data at index ${index}`);
      }
      const [result] = await pool.query(
        `INSERT INTO job_form_fields 
          (job_id, field_label, field_type, is_required, field_options, is_multi, order_no)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          job_id,
          field_label,
          field_type,
          is_required ? 1 : 0,
          JSON.stringify(field_options),
          is_multi ? 1 : 0,
          index + 1,
        ]
      );
      return result.insertId;
    });
    const insertedIds = await Promise.all(insertPromises);
    res.status(201).json({
      message: "Dynamic job form created successfully",
      insertedFields: insertedIds.length,
      field_ids: insertedIds,
    });
  } catch (err) {
    console.error("Error creating job dynamic form:", err);
    res.status(500).json({
      message: "Error creating job dynamic form",
      error: err.message,
    });
  }
};
export const getJobDynamicForm = async (req, res) => {
  try {
    const { job_id } = req.query;
    if (!job_id) {
      return res.status(400).json({ message: "job_id is required" });
    }
    const [jobRows] = await pool.query(
      "SELECT id, title FROM jobs WHERE id = ?",
      [job_id]
    );
    if (jobRows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }
    const [fields] = await pool.query(
      `SELECT 
         id AS field_id,
         field_label,
         field_type,
         is_required,
         field_options,
         is_multi,
         order_no
       FROM job_form_fields 
       WHERE job_id = ?
       ORDER BY order_no ASC`,
      [job_id]
    );
    const parsedFields = fields.map((f) => {
      let parsedOptions = [];
      if (f.field_options === null || f.field_options === undefined) {
        parsedOptions = [];
      } else if (typeof f.field_options === "string") {
        try {
          parsedOptions = JSON.parse(f.field_options);
          if (!Array.isArray(parsedOptions)) {
            parsedOptions = [];
          }
        } catch {
          parsedOptions = [];
        }
      } else if (Array.isArray(f.field_options)) {
        parsedOptions = f.field_options;
      }
      return {
        ...f,
        field_options: parsedOptions,
        is_multi: Boolean(f.is_multi),
        is_required: Boolean(f.is_required),
      };
    });
    res.status(200).json({
      job_id: parseInt(job_id),
      job_title: jobRows[0].title,
      total_fields: parsedFields.length,
      form_fields: parsedFields,
    });
  } catch (err) {
    console.error("Error fetching job dynamic form:", err);
    res.status(500).json({
      message: "Error fetching job dynamic form",
      error: err.message,
    });
  }
};
export const getApplicationResponses = async (req, res) => {
  try {
    const { application_id } = req.query;
    if (!application_id) {
      return res.status(400).json({ message: "application_id is required" });
    }
    const [responses] = await pool.query(
      `SELECT r.field_value, f.field_label, f.field_type
       FROM job_application_responses r
       JOIN job_form_fields f ON r.field_id = f.id
       WHERE r.application_id = ?`,
      [application_id]
    );
    if (!responses.length) {
      return res.status(404).json({ message: "No responses found" });
    }
    const formattedResponses = {};
    responses.forEach((r) => {
      let value = r.field_value;
      if (r.field_type === "checkbox" || r.field_type === "file") {
        try {
          value = JSON.parse(value);
        } catch {}
      }
      formattedResponses[r.field_label] = value;
    });
    res.status(200).json({
      application_id,
      responses: formattedResponses,
    });
  } catch (err) {
    console.error("Error fetching application responses:", err);
    res.status(500).json({
      message: "Error fetching application responses",
      error: err.message,
    });
  }
};
export const getApplicationsByJob = async (req, res) => {
  try {
    const { job_id } = req.query;
    if (!job_id) return res.status(400).json({ message: "job_id is required" });
    const [applications] = await pool.query(
      `SELECT id AS application_id, candidate_id, applied_at 
       FROM job_applications 
       WHERE job_id = ?`,
      [job_id]
    );
    if (!applications.length)
      return res.status(404).json({ message: "No applications found" });
    const [responses] = await pool.query(
      `SELECT r.application_id, f.field_label, f.field_type, r.field_value
       FROM job_application_responses r
       JOIN job_form_fields f ON r.field_id = f.id
       WHERE r.job_id = ?`,
      [job_id]
    );
    const formatted = applications.map((app) => {
      const appResponses = responses
        .filter((r) => r.application_id === app.application_id)
        .reduce((acc, r) => {
          let value = r.field_value;
          if (r.field_type === "checkbox" || r.field_type === "file") {
            try {
              value = JSON.parse(value);
            } catch {}
          }
          acc[r.field_label] = value;
          return acc;
        }, {});
      return {
        ...app,
        responses: appResponses,
      };
    });
    res.status(200).json({
      job_id,
      total_applications: formatted.length,
      applications: formatted,
    });
  } catch (err) {
    console.error("Error fetching applications by job:", err);
    res.status(500).json({
      message: "Error fetching applications by job",
      error: err.message,
    });
  }
};
