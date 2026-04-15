export const storage = {
  get<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(`@visa-andradina:${key}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Erro ao ler ${key} do LocalStorage`, error);
      return [];
    }
  },

  set<T>(key: string, value: T[]): void {
    try {
      localStorage.setItem(`@visa-andradina:${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Erro ao salvar ${key} no LocalStorage`, error);
    }
  }
};