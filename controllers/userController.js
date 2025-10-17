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
      "SELECT id, email,name, password FROM users WHERE email = ?",
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
      user: { id: user.id, email: user.email  ,name:user?.name},
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Failed to login" });
  } finally {
    connection.release();
  }
};

export const userLogout = async (req, res) => {
  try {
    res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Failed to logout' });
  }
};

export const userProfile = async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const connection = await pool.getConnection();
    try {
      const [userRows] = await connection.query(
        `SELECT * FROM users WHERE id = ? AND is_active = 1`,
        [id]
      );
      if (!userRows.length) {
        return res.status(404).json({ message: "User not found" });
      }

      const [projectRows] = await connection.query(
        `SELECT * FROM projects WHERE user_id = ?`,
        [id]
      );
      const [languageRows] = await connection.query(
        `SELECT * FROM user_languages WHERE user_id = ?`,
        [id]
      );
      const [educationRows] = await connection.query(
        `SELECT id, qualification_category, qualification_subcategory, university, course_type, grading_system, score, start_year, end_year FROM user_education WHERE user_id = ?`,
        [id]
      );
      const [experienceRows] = await connection.query(
        `SELECT * FROM user_experience WHERE user_id = ?`,
        [id]
      );

      const user = {
        ...userRows[0],
        projects: projectRows,
        languages: languageRows,
        education: educationRows.map((edu) => ({
          id: edu.id,
          qualification_category: edu.qualification_category || "",
          qualification_subcategory: edu.qualification_subcategory || "",
          university: edu.university || "",
          course_type: edu.course_type || "",
          grading_system: edu.grading_system || "",
          score: edu.score || "",
          start_year: edu.start_year || "",
          end_year: edu.end_year || "",
        })),
        experiences: experienceRows,
      };

      res.status(200).json(user);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Failed to fetch profile", error: error.message });
  }
};

// export const userProfileUpdate = async (req, res) => {
//   const { id } = req.params;
//   const {
//     phone,
//     address,
//     date_of_birth,
//     gender,
//     profile_picture,
//     resume,
//     resume_headline,
//     career_profile,
//     certifications,
//     skills,
//     experience,
//     job_preferences,
//     notification_settings,
//     projects,
//     languages,
//     education, // Add education to the request body
//   } = req.body;

//   const authHeader = req.headers.authorization;

//   if (!authHeader) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }

//   const token = authHeader.split(" ")[1];
//   try {
//     const connection = await pool.getConnection();
//     try {
//       await connection.beginTransaction();

//       // Validate gender
//       const validGenders = ["male", "female", "other", "prefer_not_to_say"];
//       if (gender && !validGenders.includes(gender)) {
//         console.error("Invalid gender value:", gender);
//         await connection.rollback();
//         return res.status(400).json({ message: "Invalid gender value" });
//       }

//       // Validate and format date_of_birth
//       let formattedDate = null;
//       if (date_of_birth) {
//         const date = new Date(date_of_birth);
//         if (isNaN(date.getTime())) {
//           console.error("Invalid date_of_birth:", date_of_birth);
//           await connection.rollback();
//           return res.status(400).json({ message: "Invalid date format for date_of_birth" });
//         }
//         formattedDate = date.toISOString().split("T")[0];
//         console.log("Formatted date_of_birth:", formattedDate);
//       }

//       // Update user profile
//       await connection.query(
//         `UPDATE users SET
//           phone = ?, address = ?, date_of_birth = ?, gender = ?,
//           profile_picture = ?, resume = ?, resume_headline = ?,
//           career_profile = ?, certifications = ?, skills = ?,
//           experience = ?, job_preferences = ?,
//           notification_settings = ?, updated_at = CURRENT_TIMESTAMP
//         WHERE id = ? AND is_active = 1`,
//         [
//           phone || null,
//           address || null,
//           formattedDate,
//           gender || null,
//           profile_picture || null,
//           resume || null,
//           resume_headline || null,
//           career_profile || null,
//           certifications || null,
//           skills || null,
//           experience || null,
//           job_preferences || null,
//           notification_settings || "email",
//           id,
//         ]
//       );

//       // Delete existing education records
//       await connection.query("DELETE FROM user_education WHERE user_id = ?", [id]);

//       // Insert new education records
//       if (education && education.length > 0) {
//         const educationValues = education.map((edu) => [
//           id,
//           edu.qualification_category || null,
//           edu.qualification_subcategory || null,
//           edu.university || null,
//           edu.course_type || null,
//           edu.grading_system || null,
//           edu.score || null,
//           edu.start_year || null,
//           edu.end_year || null,
//         ]);
//         await connection.query(
//           `INSERT INTO user_education (
//             user_id, qualification_category, qualification_subcategory,
//             university, course_type, grading_system, score,
//             start_year, end_year
//           ) VALUES ?`,
//           [educationValues]
//         );
//       }

//       // Delete existing projects
//       await connection.query("DELETE FROM projects WHERE user_id = ?", [id]);

//       // Insert new projects
//       if (projects && projects.length > 0) {
//         const projectValues = projects.map((p) => [
//           id,
//           p.project_title,
//           p.associated_with || null,
//           p.client || null,
//           p.project_status,
//           p.start_year || null,
//           p.start_month || null,
//           p.end_year || null,
//           p.end_month || null,
//           p.description || null,
//           p.project_location || null,
//           p.project_site || null,
//           p.employment_nature || null,
//           p.team_size || null,
//           p.role || null,
//           p.role_description || null,
//           p.skills_used || null,
//         ]);
//         await connection.query(
//           `INSERT INTO projects (
//             user_id, project_title, associated_with, client, project_status,
//             start_year, start_month, end_year, end_month, description,
//             project_location, project_site, employment_nature, team_size,
//             role, role_description, skills_used
//           ) VALUES ?`,
//           [projectValues]
//         );
//       }

//       // Delete existing languages
//       await connection.query("DELETE FROM user_languages WHERE user_id = ?", [id]);

//       // Insert new languages
//       if (languages && languages.length > 0) {
//         const languageValues = languages.map((l) => [id, l.language, l.proficiency]);
//         await connection.query(
//           `INSERT INTO user_languages (user_id, language, proficiency) VALUES ?`,
//           [languageValues]
//         );
//       }

//       await connection.commit();
//       console.log("Profile updated for user:", id, { date_of_birth: formattedDate, gender, education });
//       res.status(200).json({ message: "Profile updated successfully" });
//     } catch (error) {
//       await connection.rollback();
//       console.error("Error updating profile:", error);
//       res.status(500).json({ message: "Failed to update profile", error: error.message });
//     } finally {
//       connection.release();
//     }
//   } catch (error) {
//     console.error("Token verification failed:", error);
//     res.status(401).json({ message: "Invalid or expired token" });
//   }
// };
export const userProfileUpdate = async (req, res) => {
  const { id } = req.params;
  const {
    phone,
    address,
    date_of_birth,
    gender,
    profile_picture,
    resume,
    resume_headline,
    career_profile,
    certifications,
    skills,
    experiences, // Add experiences to the request body
    job_preferences,
    notification_settings,
    projects,
    languages,
    education,
  } = req.body;

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Validate gender
      const validGenders = ["male", "female", "other", "prefer_not_to_say"];
      if (gender && !validGenders.includes(gender)) {
        console.error("Invalid gender value:", gender);
        await connection.rollback();
        return res.status(400).json({ message: "Invalid gender value" });
      }

      // Validate and format date_of_birth
      let formattedDate = null;
      if (date_of_birth) {
        const date = new Date(date_of_birth);
        if (isNaN(date.getTime())) {
          console.error("Invalid date_of_birth:", date_of_birth);
          await connection.rollback();
          return res.status(400).json({ message: "Invalid date format for date_of_birth" });
        }
        formattedDate = date.toISOString().split("T")[0];
        console.log("Formatted date_of_birth:", formattedDate);
      }

      // Update user profile (remove experience from users table)
      await connection.query(
        `UPDATE users SET
          phone = ?, address = ?, date_of_birth = ?, gender = ?,
          profile_picture = ?, resume = ?, resume_headline = ?,
          career_profile = ?, certifications = ?, skills = ?,
          job_preferences = ?, notification_settings = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1`,
        [
          phone || null,
          address || null,
          formattedDate,
          gender || null,
          profile_picture || null,
          resume || null,
          resume_headline || null,
          career_profile || null,
          certifications || null,
          skills || null,
          job_preferences || null,
          notification_settings || "email",
          id,
        ]
      );

      // Delete existing experience records
      await connection.query("DELETE FROM user_experience WHERE user_id = ?", [id]);

      // Insert new experience records
      if (experiences && experiences.length > 0) {
        const experienceValues = experiences.map((exp) => [
          id,
          exp.is_fresher || 0,
          exp.company_name || null,
          exp.designation || null,
          exp.location || null,
          exp.start_date ? `${exp.start_date}-01` : null, // Convert YYYY-MM to YYYY-MM-DD
          exp.end_date ? `${exp.end_date}-01` : null, // Convert YYYY-MM to YYYY-MM-DD
          exp.responsibilities || null,
        ]);
        await connection.query(
          `INSERT INTO user_experience (
            user_id, is_fresher, company_name, designation,
            location, start_date, end_date, responsibilities
          ) VALUES ?`,
          [experienceValues]
        );
      } else {
        // Insert a fresher record if is_fresher is true
        if (experiences && experiences.is_fresher) {
          await connection.query(
            `INSERT INTO user_experience (
              user_id, is_fresher
            ) VALUES (?, ?)`,
            [id, 1]
          );
        }
      }

      // Delete existing education records
      await connection.query("DELETE FROM user_education WHERE user_id = ?", [id]);

      // Insert new education records
      if (education && education.length > 0) {
        const educationValues = education.map((edu) => [
          id,
          edu.qualification_category || null,
          edu.qualification_subcategory || null,
          edu.university || null,
          edu.course_type || null,
          edu.grading_system || null,
          edu.score || null,
          edu.start_year || null,
          edu.end_year || null,
        ]);
        await connection.query(
          `INSERT INTO user_education (
            user_id, qualification_category, qualification_subcategory,
            university, course_type, grading_system, score,
            start_year, end_year
          ) VALUES ?`,
          [educationValues]
        );
      }

      // Delete existing projects
      await connection.query("DELETE FROM projects WHERE user_id = ?", [id]);

      // Insert new projects
      if (projects && projects.length > 0) {
        const projectValues = projects.map((p) => [
          id,
          p.project_title,
          p.associated_with || null,
          p.client || null,
          p.project_status,
          p.start_year || null,
          p.start_month || null,
          p.end_year || null,
          p.end_month || null,
          p.description || null,
          p.project_location || null,
          p.project_site || null,
          p.employment_nature || null,
          p.team_size || null,
          p.role || null,
          p.role_description || null,
          p.skills_used || null,
        ]);
        await connection.query(
          `INSERT INTO projects (
            user_id, project_title, associated_with, client, project_status,
            start_year, start_month, end_year, end_month, description,
            project_location, project_site, employment_nature, team_size,
            role, role_description, skills_used
          ) VALUES ?`,
          [projectValues]
        );
      }

      // Delete existing languages
      await connection.query("DELETE FROM user_languages WHERE user_id = ?", [id]);

      // Insert new languages
      if (languages && languages.length > 0) {
        const languageValues = languages.map((l) => [id, l.language, l.proficiency]);
        await connection.query(
          `INSERT INTO user_languages (user_id, language, proficiency) VALUES ?`,
          [languageValues]
        );
      }

      await connection.commit();
      console.log("Profile updated for user:", id, { date_of_birth: formattedDate, gender, experiences, education });
      res.status(200).json({ message: "Profile updated successfully" });
    } catch (error) {
      await connection.rollback();
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile", error: error.message });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Token verification failed:", error);
    res.status(401).json({ message: "Invalid or expired token" });
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
