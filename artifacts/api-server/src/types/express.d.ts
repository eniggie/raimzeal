// Augments Express's Request with the fields set by requireAuth/optionalAuth
// (see src/middleware/auth.ts), so route handlers can read req.userId /
// req.userEmail without an `as any` cast.
declare namespace Express {
  export interface Request {
    userId?: string;
    userEmail?: string;
  }
}
