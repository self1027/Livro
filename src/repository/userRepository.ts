import { storage } from '../services/storage';
import type { User, CreateUserDTO } from '../types/user';

const KEY = 'usuarios';

export const userRepository = {
  // Retorna todos os usuários (Fiscais)
  findAll(): User[] {
    return storage.get<User>(KEY);
  },

  // Busca um usuário específico pelo ID
  findById(id: string): User | undefined {
    const all = this.findAll();
    return all.find(u => u.id === id);
  },

  // Salva um novo usuário
  save(dto: CreateUserDTO): User {
    const all = this.findAll();
    
    const newUser: User = {
      ...dto,
      id: crypto.randomUUID(),
    };

    storage.set(KEY, [...all, newUser]);
    return newUser;
  },

  // Atualiza nome ou status de atividade
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

  // Deleta o usuário do storage
  delete(id: string): void {
    const all = this.findAll();
    const filtered = all.filter(u => u.id !== id);
    storage.set(KEY, filtered);
  },

  // Retorna apenas os usuários ativos (útil para popular selects)
  findActive(): User[] {
    return this.findAll().filter(u => u.isActive);
  }
};