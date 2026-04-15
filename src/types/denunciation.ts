import { DenunciationSender } from '../constants/denunciations';

export interface Denunciation {
  id: string;
  year: number;
  number: number;
  registration_type: typeof DenunciationSender[keyof typeof DenunciationSender];
  title: string;
  description: string;
  
  // Endereço estruturado
  location: {
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string; // Default: Andradina
    state: string; // Default: SP
  };

  // Status da denúncia (Slug do DENUNCIATION_STATUS)
  status: string;

  // Auditoria e Controle
  createdAt: string; // ISO Date
  updatedAt: string; // ISO Date
}

export type CreateDenunciationDTO = Omit<
  Denunciation, 
  'id' | 'status' | 'createdAt' | 'updatedAt' | 'number'
> & {
  registration_type: typeof DenunciationSender[keyof typeof DenunciationSender] | "";
};