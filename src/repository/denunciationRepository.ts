import { storage } from '../services/storage';
import type { Denunciation, CreateDenunciationDTO } from '../types/denunciation';
import { DENUNCIATION_STATUS } from '../constants/denunciations';

const KEY = 'denuncias';

export const denunciaRepository = {
  findAll(): Denunciation[] {
    return storage.get<Denunciation>(KEY);
  },

  // A MÁGICA ACONTECE AQUI:
  // Recebe os dados crus do form (DTO) e gera a entidade completa
  save(dto: CreateDenunciationDTO): Denunciation {
    const all = this.findAll();
    const year = new Date().getFullYear();
    
    // Lógica de numeração sequencial
    const yearlyDenunciations = all.filter(d => d.year === year);
    const nextNumber = yearlyDenunciations.length > 0 
      ? Math.max(...yearlyDenunciations.map(d => d.number)) + 1 
      : 1;

    const newDenunciation: Denunciation = {
      ...dto,
      id: crypto.randomUUID(),
      year,
      number: nextNumber,
      status: DENUNCIATION_STATUS.REGISTRADA.slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.set(KEY, [newDenunciation, ...all]);
    return newDenunciation;
  },

  update(id: string, data: Partial<Denunciation>): void {
    const all = this.findAll();
    const index = all.findIndex(d => d.id === id);
    if (index !== -1) {
      all[index] = { 
        ...all[index], 
        ...data, 
        updatedAt: new Date().toISOString() 
      };
      storage.set(KEY, all);
    }
  }
};