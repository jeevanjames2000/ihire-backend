import express from 'express';
import authenticate from '../middleware/auth.js';
import { createInvite, validateInvite, acceptInvite, registerWithInvite, getCompanyInvites, deleteCompanyInvite } from '../controllers/invitesController.js';

const router = express.Router();

router.post('/send-invite', authenticate, async (req, res, next) => {
  const { email, role } = req.body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!role || !['admin', 'recruiter', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    await createInvite(req, res);
  } catch (err) {
    next(err);
  }
});

router.get('/validate', validateInvite);

router.post('/accept', authenticate, async (req, res, next) => {
  const { token } = req.body;


  if (!token || token.trim() === '') {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    await acceptInvite(req, res);
  } catch (err) {
    next(err);
  }
});

router.post("/intiveRegister", registerWithInvite)
router.get('/RecruiterInvites', authenticate, getCompanyInvites);
router.delete('/deleteInvites/:inviteId', authenticate, deleteCompanyInvite);
export default router;