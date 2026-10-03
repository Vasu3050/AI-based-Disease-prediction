/** Express request augmentation for authenticated users. */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: 'user' | 'admin';
      };
    }
  }
}

export {};
