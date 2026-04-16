import { storage } from '../services/storage';
import type { Denunciation, CreateDenunciationDTO } from '../types/denunciation';

const KEY = 'denuncias';

export const denunciaRepository = {
  findAll(): Denunciation[] {
    const denuncias = storage.get<Denunciation>(KEY) || [];

    return denuncias.sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year;
      }
      return b.number - a.number;
    });
  },

  findById(id: string): Denunciation | undefined {
    const all = this.findAll();
    return all.find(d => d.id === id);
  },

  getNextNumber(year: number): number {
    const all = this.findAll();
    const yearlyDenunciations = all.filter(d => d.year === year);
    return yearlyDenunciations.length > 0 
      ? Math.max(...yearlyDenunciations.map(d => d.number)) + 1 
      : 1;
  },

  save(dto: CreateDenunciationDTO): Denunciation {
    const all = this.findAll();
    const year = new Date().getFullYear();
    
    const nextNumber = this.getNextNumber(year);

    const newDenunciation: Denunciation = {
      ...dto,
      id: crypto.randomUUID(),
      year,
      number: nextNumber,
      status: 'REGISTRADA',
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
  },

  search(filters: {
  year?: string,
  number?: string,
  street?: string,
  houseNumber?: string,
  district?: string,
  status?: string,
  registration_type?: string,
  userId?: string
}): Denunciation[] {
  const all = this.findAll();
  
  return all.filter(d => {
    return (
      (!filters.year || d.year.toString() === filters.year) &&
      (!filters.number || d.number.toString() === filters.number) &&
      (!filters.street || d.location.street.toLowerCase().includes(filters.street.toLowerCase())) &&
      (!filters.houseNumber || d.location.number === filters.houseNumber) &&
      (!filters.district || d.location.district.toLowerCase().includes(filters.district.toLowerCase())) &&
      (!filters.status || d.status === filters.status) &&
      (!filters.registration_type || d.registration_type === filters.registration_type) &&
      (!filters.userId || d.userId === filters.userId)
    );
  });
},

assignUser(denunciaId: string, userId: string | null): void {
  const all = this.findAll();
  const index = all.findIndex(d => d.id === denunciaId);
  
  if (index !== -1) {
    all[index] = { 
      ...all[index], 
      userId: userId || undefined, 
      updatedAt: new Date().toISOString() 
    };
    storage.set(KEY, all);
  }
},
};