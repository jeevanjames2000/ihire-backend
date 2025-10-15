import { randomBytes } from 'crypto';
import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import { sendInviteEmail } from '../utils/services/mailService.js';



export const createInvite = async (req, res) => {
  const { email, role } = req.body;
  const { id: created_by, company_id, role: userRole } = req.user;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!role || !['admin', 'recruiter', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (!['owner', 'admin' ,`recruiter`].includes(userRole)) {
    return res.status(403).json({ error: 'Only owners or admins can create invites' });
  }

  try {
    const [company] = await pool.query('SELECT id, name FROM companies WHERE id = ?', [company_id]);
    if (!company.length) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [result] = await pool.query(
      `INSERT INTO invites (company_id, email, token_hash, expires_at, created_by, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [company_id, email, tokenHash, expiresAt, created_by, role]
    );
  
    const inviteLink = `http://localhost:3000/api/invites/accept?token=${encodeURIComponent(token)}`;
    const emailSent = await sendInviteEmail(email, inviteLink, company[0].name, role);
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send invite email' });
    }

    res.status(201).json({ message: 'Invite created and email sent successfully', inviteId: result.insertId, token });
  } catch (error) {
    console.error('Error creating invite:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

export const validateInvite = async (req, res) => {
  const { token } = req.query;
  if (!token || token.trim() === '') {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const [invites] = await pool.query(
      `SELECT i.id, i.company_id, i.email, i.used, i.expires_at, i.token_hash, i.role, c.name AS company_name
       FROM invites i
       JOIN companies c ON i.company_id = c.id
       WHERE i.used = FALSE AND i.expires_at > NOW()`,
      []
    );
    let validInvite = null;
    for (const invite of invites) {
      if (await bcrypt.compare(token, invite.token_hash)) {
        validInvite = invite;
        break;
      }
    }

    if (!validInvite) {
      return res.status(400).json({ error: 'Invalid, used, or expired token' });
    }
    res.status(200).json({
      email: validInvite.email,
      company_name: validInvite.company_name,
      role: validInvite.role,
      company_id: validInvite.company_id,
    });
  } catch (error) {
    console.error('Error validating invite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const acceptInvite = async (req, res) => {
  const { token } = req.body;
  const { id: recruiter_id, email } = req.user;


  if (!token || token.trim() === '') {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const [invites] = await pool.query(
      `SELECT i.id, i.company_id, i.email, i.used, i.expires_at, i.token_hash, i.role
       FROM invites i
       WHERE i.used = FALSE AND i.expires_at > NOW()`,
      []
    );


    let validInvite = null;
    for (const invite of invites) {
      if (await bcrypt.compare(token, invite.token_hash)) {
        validInvite = invite;
        break;
      }
    }

    if (!validInvite) {
      return res.status(400).json({ error: 'Invalid, used, or expired token' });
    }

    if (validInvite.email !== email) {
      return res.status(403).json({ error: 'Invite is not for this email' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE invites
         SET used = TRUE, used_by = ?, used_at = NOW()
         WHERE id = ?`,
        [recruiter_id, validInvite.id]
      );

      await connection.query(
        `UPDATE recruiters
         SET company_id = ?, role = ?
         WHERE id = ?`,
        [validInvite.company_id, validInvite.role, recruiter_id]
      );

      await connection.commit();
      res.status(200).json({ message: 'Invite accepted successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error accepting invite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const registerWithInvite = async (req, res) => {
   const { token, name, password, designation } = req.body;

  if (!token || !name || !password) {
    return res.status(400).json({ error: 'Token, name, and password are required' });
  }

  try {
    const [invites] = await pool.query(
      `SELECT i.id, i.company_id, i.email, i.used, i.expires_at, i.token_hash, i.role
       FROM invites i
       WHERE i.used = FALSE AND i.expires_at > NOW()`,
      []
    );

    let validInvite = null;
    for (const invite of invites) {
      if (await bcrypt.compare(token, invite.token_hash)) {
        validInvite = invite;
        break;
      }
    }

    if (!validInvite) {
      return res.status(400).json({ error: 'Invalid, used, or expired token' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO recruiters (name, email, password, company_id, role, designation, is_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          validInvite.email,
          passwordHash,
          validInvite.company_id,
          validInvite.role,
          designation || null,
          true,
        ]
      );

      const newRecruiterId = result.insertId;

      await connection.query(
        `UPDATE invites
         SET used = TRUE, used_by = ?, used_at = NOW()
         WHERE id = ?`,
        [newRecruiterId, validInvite.id]
      );

      const authToken = jwt.sign(
        { id: newRecruiterId, email: validInvite.email, role: validInvite.role, company_id: validInvite.company_id },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '7d' }
      );
      await connection.commit();
      res.status(201).json({ message: 'Registration successful', authToken });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const getCompanyInvites = async (req, res) => {
  let connection;
  try {
    const { company_id: companyId } = req.user; 
    if (!companyId) {
      return res.status(401).json({ error: 'Company not found' });
    }

    connection = await pool.getConnection();

    const [invites] = await connection.execute(
      `SELECT 
          ci.id, 
          ci.email, 
          ci.created_at, 
          ci.used,
          r.name AS invited_by_name
       FROM invites ci
       JOIN recruiters r ON ci.created_by = r.id
       WHERE ci.company_id = ?
       ORDER BY ci.created_at DESC`,
      [companyId]
    );

    res.status(200).json({
      message: 'Invites fetched successfully',
      invites,
      count: invites.length,
    });
  } catch (error) {
    console.error('Get company invites error:', error);
    res.status(500).json({ error: 'Something went wrong', details: error.message });
  } finally {
    if (connection) connection.release();
  }
};


export const deleteCompanyInvite = async (req, res) => {
  let connection;
  try {
    const { inviteId } = req.params;
    const { company_id: companyId } = req.user;

    if (!companyId) {
      return res.status(401).json({ error: "Company not found" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [invite] = await connection.execute(
      "SELECT email FROM invites WHERE id = ? AND company_id = ?",
      [inviteId, companyId]
    );

    if (invite.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ error: "Invite not found or unauthorized" });
    }

    const invitedEmail = invite[0].email;

    await connection.execute("DELETE FROM invites WHERE id = ?", [inviteId]);


    await connection.execute(
      "DELETE FROM recruiters WHERE email = ? AND company_id = ?",
      [invitedEmail, companyId]
    );

    await connection.commit();

    res
      .status(200)
      .json({ message: "Invite and associated recruiter deleted successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Delete invite error:", error);
    res
      .status(500)
      .json({ error: "Something went wrong", details: error.message });
  } finally {
    if (connection) connection.release();
  }
};
