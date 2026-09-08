import { USER_ROLES, type UserRole } from '@packcheck/shared';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export interface TokenSigner {
  sign(user: AuthUser): Promise<string>;
}

export class AuthService {
  constructor(private readonly signer: TokenSigner) {}

  roles(): readonly UserRole[] {
    return USER_ROLES;
  }

  async issueSession(user: AuthUser): Promise<{ token: string; user: AuthUser }> {
    return { token: await this.signer.sign(user), user };
  }
}
