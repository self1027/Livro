import { storage } from '../services/storage';
import type { User, CreateUserDTO } from '../types/user';

const KEY = 'usuarios';

export const userRepository = {
  findAll(): User[] {
    return storage.get<User>(KEY);
  },

  findById(id: string): User | undefined {
    const all = this.findAll();
    return all.find(u => u.id === id);
  },

  save(dto: CreateUserDTO): User {
    const all = this.findAll();
    
    const newUser: User = {
      ...dto,
      id: crypto.randomUUID(),
    };

    storage.set(KEY, [...all, newUser]);
    return newUser;
  },

  update(id: string, data: Partial<CreateUserDTO>): void {
    const all = this.findAll();
    const index = all.findIndex(u => u.id === id);
    
    if (index !== -1) {
      all[index] = { 
        ...all[index], 
        ...data 
      };
      storage.set(KEY, all);
    }
  },

  delete(id: string): void {
    const all = this.findAll();
    const filtered = all.filter(u => u.id !== id);
    storage.set(KEY, filtered);
  },

  findActive(): User[] {
    return this.findAll().filter(u => u.isActive);
  }
};