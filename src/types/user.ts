export interface User {
  id: string;
  name: string;
  isActive: boolean;
}

export type CreateUserDTO = Omit<User, 'id'>;