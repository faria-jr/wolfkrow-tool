import type { User } from '../entities/user';

import type { Repository } from './index';

/** Port de repositório de usuário. Single-user app → findOwner(). */
export interface UserRepo extends Repository<User, string> {
  findOwner(): Promise<User | null>;
}
