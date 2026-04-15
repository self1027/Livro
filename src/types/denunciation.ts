import { DenunciationSender } from '../constants/denunciations';

export interface Denunciation {
  id: string;
  year: number;
  number: number;
  registration_type: typeof DenunciationSender[keyof typeof DenunciationSender];
  title: string;
  description: string;
  
  location: {
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string;
  };

  status: string;

  createdAt: string;
  updatedAt: string;

  userId?: string;
}

export type CreateDenunciationDTO = Omit<
  Denunciation, 
  'id' | 'status' | 'createdAt' | 'updatedAt' | 'number'
> & {
  registration_type: typeof DenunciationSender[keyof typeof DenunciationSender] | "";
};