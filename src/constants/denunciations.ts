export const DenunciationSender = {
  TELEFONE: 'TELEFONE',
  PRESENCIAL: 'PRESENCIAL',
  OFICIO: 'OFICIO',
  MINISTERIO_PUBLICO: 'MINISTERIO_PUBLICO',
  OUVIDORIA: 'OUVIDORIA',
} as const;

export type DenunciationSenderType = keyof typeof DenunciationSender;

export const DenunciationSenderLabel: Record<string, string> = {
  [DenunciationSender.TELEFONE]: 'Telefone',
  [DenunciationSender.PRESENCIAL]: 'Presencial',
  [DenunciationSender.OFICIO]: 'Ofício',
  [DenunciationSender.MINISTERIO_PUBLICO]: 'Ministério Público',
  [DenunciationSender.OUVIDORIA]: 'Ouvidoria',
};

export const DENUNCIATION_STATUS = {
    REGISTRADA: {
        label: "Registrada",
        color: "#3498db",
        slug: "REGISTRADA"
    },
    EM_ANDAMENTO: {
        label: "Em Andamento",
        color: "#f39c12",
        slug: "EM_ANDAMENTO"
    },
    NOTIFICADA: {
        label: "Notificada",
        color: "#2ecc71",
        slug: "NOTIFICADA"
    },
    EM_PUBLICACAO: {
        label: "Em Publicação",
        color: "#8e44ad",
        slug: "EM_PUBLICACAO"
    },
    FEITO_AIF: {
        label: "Em Processo Administrativo",
        color: "#16a085",
        slug: "FEITO_AIF"
    },
    PENDENTE: {
        label: "Pendente",
        color: "#e74c3c",
        slug: "PENDENTE"
    },
    FINALIZADA: {
        label: "Finalizada",
        color: "#95a5a6",
        slug: "FINALIZADA"
    }
} as const;

export type DenunciationStatusSlug = keyof typeof DENUNCIATION_STATUS;