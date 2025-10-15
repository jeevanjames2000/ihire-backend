import jwt from 'jsonwebtoken';


export function getTokenPayload(authorizationHeader) {
  try {
    if (!authorizationHeader) return null;
    const token = (authorizationHeader.split && authorizationHeader.split(' ')[1]) || authorizationHeader;
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('getTokenPayload: JWT_SECRET is not configured');
      return null;
    }
    const decoded = jwt.verify(token, secret);
    if (!decoded) return null;
    return {
      id: decoded.userId ?? decoded.id ?? null,
      email: decoded.email ?? null,
      role: decoded.role ?? null,
      company_id: decoded.company_id ?? null,
      raw: decoded, 
    };
  } catch (err) {
  
    return null;
  }
}
const authenticate = (req, res, next) => {
  try {
   
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn(`Authentication failed: Missing or invalid Authorization header`, {
        authHeader: authHeader || 'none',
        path: req.path,
        method: req.method,
      });
      return res.status(401).json({
        error: 'Authentication required',
        details: 'Authorization header with Bearer token is required',
      });
    }

 
    const token = authHeader.split(' ')[1];
    if (!token) {
      console.warn(`Authentication failed: No token provided`, {
        authHeader,
        path: req.path,
        method: req.method,
      });
      return res.status(401).json({
        error: 'Authentication required',
        details: 'No token found in Authorization header',
      });
    }

  
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('Authentication failed: JWT_SECRET is not configured', {
        path: req.path,
        method: req.method,
      });
      return res.status(500).json({
        error: 'Server configuration error',
        details: 'JWT secret key is not configured',
      });
    }

    const decoded = jwt.verify(token, secret);
    if (!decoded.userId || !decoded.role) {
      console.warn(`Authentication failed: Incomplete token payload`, {
        decoded,
        path: req.path,
        method: req.method,
      });
      return res.status(401).json({
        error: 'Invalid token',
        details: 'Token payload is missing required fields (userId or role)',
      });
    }

   
    req.user = {
      id: decoded.userId, 
      email: decoded.email || null,
      role: decoded.role,
      company_id: decoded.company_id || null, 
    };

    next();
  } catch (err) {
    console.error('Authentication error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
    return res.status(401).json({
      error: 'Invalid or expired token',
      details: err.message,
    });
  }
};

export default authenticate;