import type { Report, CreateReportDTO } from '../types/report';

const LOCAL_STORAGE_KEY = '@visa-andradina:reports';

export const reportRepository = {
  findAll(): Report[] {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  findById(id: string): Report | undefined {
    return this.findAll().find(r => r.id === id);
  },

  findByDenunciation(denunciationId: string): Report[] {
    const reports = this.findAll();
    return reports
      .filter(r => r.denunciation_id === denunciationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  save(data: CreateReportDTO): Report {
    const reports = this.findAll();
    
    const newReport: Report = {
      id: Math.random().toString(36).substr(2, 9),
      ...data,
      createdAt: new Date().toISOString()
    };

    reports.push(newReport);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reports));
    
    return newReport;
  },

  update(id: string, data: Partial<Report>): Report | null {
    const reports = this.findAll();
    const index = reports.findIndex(r => r.id === id);
    
    if (index === -1) return null;

    reports[index] = { ...reports[index], ...data };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reports));
    
    return reports[index];
  },

  delete(id: string): boolean {
    const reports = this.findAll();
    const filtered = reports.filter(r => r.id !== id);
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }
};