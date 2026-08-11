export type Role = "ADMIN" | "SALES" | "WAREHOUSE" | "ACCOUNTS";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
