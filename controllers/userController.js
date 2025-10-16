import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import upload from "../middleware/upload.js";

export const userRegister = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Name, email, and password are required" });
  }

  const connection = await pool.getConnection();
  try {
    const [existingUsers] = await connection.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await connection.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );
    const token = jwt.sign(
      { id: result.insertId, email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    const user = { id: result.insertId, name, email };
    res.status(201).json({ message: "Registration successful", user, token });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Failed to register" });
  } finally {
    connection.release();
  }
};
export const userLogin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const connection = await pool.getConnection();
  try {
    const [users] = await connection.query(
      "SELECT id, email, password FROM users WHERE email = ?",
      [email]
    );
    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    await connection.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Failed to login" });
  } finally {
    connection.release();
  }
};

export const userLogout = async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const expiresAt = new Date(decoded.exp * 1000);

    await pool.query(
      "INSERT INTO blacklisted_tokens (token, expires_at) VALUES (?, ?)",
      [token, expiresAt]
    );
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Failed to logout" });
  }
};

export const userProfile=async(req,res)=>{
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
export const userProfileUpdate = async (req, res) => {
  const { id } = req.params;
  const { profile, languages, projects } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE users SET 
        phone = ?, address = ?, date_of_birth = ?, gender = ?, 
        profile_picture = ?, resume = ?, resume_headline = ?, 
        career_profile = ?, certifications = ?, skills = ?, 
        education = ?, experience = ?, job_preferences = ?, 
        notification_settings = ?
      WHERE id = ?`,
      [
        profile.phone || null,
        profile.address || null,
        profile.date_of_birth || null,
        profile.gender || null,
        profile.profile_picture || null,
        profile.resume || null,
        profile.resume_headline || null,
        profile.career_profile || null,
        profile.certifications || null,
        profile.skills || null,
        profile.education || null,
        profile.experience || null,
        profile.job_preferences || null,
        profile.notification_settings || "email",
        id,
      ]
    );

    await connection.query("DELETE FROM user_languages WHERE user_id = ?", [
      id,
    ]);
    for (const { language, proficiency } of languages) {
      if (language && proficiency) {
        await connection.query(
          "INSERT INTO user_languages (user_id, language, proficiency) VALUES (?, ?, ?)",
          [id, language, proficiency]
        );
      }
    }

    await connection.query("DELETE FROM projects WHERE user_id = ?", [id]);
    for (const project of projects) {
      if (project.project_title && project.project_status) {
        await connection.query(
          `INSERT INTO projects (
            user_id, project_title, associated_with, client, project_status, 
            start_year, start_month, end_year, end_month, description, 
            project_location, project_site, employment_nature, team_size, 
            role, role_description, skills_used
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            project.project_title,
            project.associated_with || null,
            project.client || null,
            project.project_status,
            project.start_year || null,
            project.start_month || null,
            project.end_year || null,
            project.end_month || null,
            project.description || null,
            project.project_location || null,
            project.project_site || null,
            project.employment_nature || null,
            project.team_size || null,
            project.role || null,
            project.role_description || null,
            project.skills_used || null,
          ]
        );
      }
    }

    await connection.commit();
    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Failed to update profile" });
  } finally {
    connection.release();
  }
};

export const getSavedJobs=async (req, res) => {
  const user_id = req.userId;

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT j.* FROM saved_jobs s JOIN jobs j ON s.job_id = j.id WHERE s.user_id = ?',
      [user_id]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    res.status(500).json({ message: 'Failed to fetch saved jobs' });
  } finally {
    connection.release();
  }
}
export const saveJobs= async (req, res) => {
  const { job_id } = req.body;
  const user_id = req.userId;

  if (!job_id) {
    return res.status(400).json({ message: 'Job ID is required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.query(
      'INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE job_id = job_id',
      [user_id, job_id]
    );
    res.status(201).json({ message: 'Job saved successfully' });
  } catch (error) {
    console.error('Error saving job:', error);
    res.status(500).json({ message: 'Failed to save job' });
  } finally {
    connection.release();
  }
}

export const deleteSavedjob=async (req, res) => {
  const user_id = req.userId;
  const { job_id } = req.params;

  if (!job_id) {
    return res.status(400).json({ message: 'Job ID is required' });
  }

  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      'DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?',
      [user_id, job_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Job not found in saved jobs' });
    }
    res.status(200).json({ message: 'Job unsaved successfully' });
  } catch (error) {
    console.error('Error unsaving job:', error);
    res.status(500).json({ message: 'Failed to unsave job' });
  } finally {
    connection.release();
  }
}
