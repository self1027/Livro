const USERS_KEY = '@visa-andradina:usuarios';
const REPORTS_KEY = '@visa-andradina:reports';
const DENUNCIAS_KEY = '@visa-andradina:denuncias';

const seedData = {
  users: [
    {
      "id": "076ab705-b076-4408-ba1d-caf8ddae5246",
      "name": "Bruno Simon",
      "isActive": true
    },
    {
      "id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "name": "Ricardo Fontes",
      "isActive": true
    },
    {
      "id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "name": "Luis Eduardo",
      "isActive": true
    }
  ],
  
  reports: [
    {
      "id": "rep1",
      "denunciation_id": "280f6e1b-24b8-4cfe-840f-d7402d72ba39",
      "user_id": "076ab705-b076-4408-ba1d-caf8ddae5246",
      "createdAt": "2026-04-15T09:00:00.000Z",
      "type": 1,
      "description": "Diligência realizada para atender requisição do Ministério Público. No local, foi constatado extravasamento de efluentes domésticos em direção à via pública devido a uma falha na caixa de inspeção do imóvel. O proprietário não se encontrava, porém a moradora foi orientada sobre o risco sanitário."
    },
    {
      "id": "sys1",
      "denunciation_id": "280f6e1b-24b8-4cfe-840f-d7402d72ba39",
      "user_id": "076ab705-b076-4408-ba1d-caf8ddae5246",
      "createdAt": "2026-04-15T09:00:01.000Z",
      "type": 2,
      "description": "Status alterado de \"Registrada\" para \"Em Andamento\"."
    },
    {
      "id": "rep2",
      "denunciation_id": "280f6e1b-24b8-4cfe-840f-d7402d72ba39",
      "user_id": "076ab705-b076-4408-ba1d-caf8ddae5246",
      "createdAt": "2026-04-15T14:30:00.000Z",
      "type": 1,
      "description": "Retorno ao local para entrega de Notificação formal. O responsável foi identificado e assinou o Auto de Notificação nº 88/2026, comprometendo-se a realizar o reparo na rede de esgoto interna e a limpeza da calçada no prazo de 24 horas."
    },
    {
      "id": "sys2",
      "denunciation_id": "280f6e1b-24b8-4cfe-840f-d7402d72ba39",
      "user_id": "076ab705-b076-4408-ba1d-caf8ddae5246",
      "createdAt": "2026-04-15T14:30:01.000Z",
      "type": 2,
      "description": "Status alterado de \"Em Andamento\" para \"Notificada\"."
    },
    {
      "id": "rep3",
      "denunciation_id": "280f6e1b-24b8-4cfe-840f-d7402d72ba39",
      "user_id": "076ab705-b076-4408-ba1d-caf8ddae5246",
      "createdAt": "2026-04-16T10:15:00.000Z",
      "type": 1,
      "description": "Vistoria de retorno para verificação de cumprimento de prazo. Constatado que o reparo na tubulação foi devidamente executado e o escoamento irregular foi estancado. Local higienizado. Diante da regularização da situação de saneamento, dou a denúncia por encerrada."
    },
    {
      "id": "sys3",
      "denunciation_id": "280f6e1b-24b8-4cfe-840f-d7402d72ba39",
      "user_id": "076ab705-b076-4408-ba1d-caf8ddae5246",
      "createdAt": "2026-04-16T10:15:01.000Z",
      "type": 2,
      "description": "Status alterado de \"Notificada\" para \"Finalizada\"."
    },
    {
      "id": "rep4",
      "denunciation_id": "a19fdd59-2a31-4557-a22d-bc74ceb5ce22",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T08:30:00.000Z",
      "type": 1,
      "description": "Vistoria realizada no local. Constatado terreno com vegetação alta e diversos recipientes acumulando água parada com presença de larvas. Vizinhos consultados informaram desconhecer o atual proprietário ou paradeiro do responsável."
    },
    {
      "id": "sys4",
      "denunciation_id": "a19fdd59-2a31-4557-a22d-bc74ceb5ce22",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T08:31:00.000Z",
      "type": 2,
      "description": "Status alterado de \"Registrada\" para \"Em Andamento\"."
    },
    {
      "id": "rep5",
      "denunciation_id": "a19fdd59-2a31-4557-a22d-bc74ceb5ce22",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T11:45:00.000Z",
      "type": 1,
      "description": "Realizada diligência em imóvel vinculado ao CPF no Cadastro Imobiliário, porém o local encontra-se para alugar e desocupado. Tentativa de contato via telefone sem sucesso. Imóvel em estado de abandono há meses."
    },
    {
      "id": "sys5",
      "denunciation_id": "a19fdd59-2a31-4557-a22d-bc74ceb5ce22",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T11:45:01.000Z",
      "type": 2,
      "description": "Status alterado de \"Em Andamento\" para \"Pendente\"."
    },
    {
      "id": "rep6",
      "denunciation_id": "a19fdd59-2a31-4557-a22d-bc74ceb5ce22",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T16:20:00.000Z",
      "type": 1,
      "description": "Esgotadas todas as vias de localização presencial e remota do infrator. Encaminho o processo para publicação de Edital em Diário Oficial do Município para notificação por via pública devido ao risco epidemiológico."
    },
    {
      "id": "sys6",
      "denunciation_id": "a19fdd59-2a31-4557-a22d-bc74ceb5ce22",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T16:20:01.000Z",
      "type": 2,
      "description": "Status alterado de \"Pendente\" para \"Em Publicação\"."
    },
    {
      "id": "rep7",
      "denunciation_id": "fec0af56-618d-468b-9869-dc7a64e857d4",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-14T10:00:00.000Z",
      "type": 1,
      "description": "Diligência realizada em conjunto com o Setor de Posturas. Deixado Termo de Convocação sob o portão para comparecimento ao Setor de Vigilância Sanitária no prazo de 24 horas."
    },
    {
      "id": "sys7",
      "denunciation_id": "fec0af56-618d-468b-9869-dc7a64e857d4",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-14T10:01:00.000Z",
      "type": 2,
      "description": "Status alterado de \"Registrada\" para \"Em Andamento\"."
    },
    {
      "id": "rep8",
      "denunciation_id": "fec0af56-618d-468b-9869-dc7a64e857d4",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-15T14:15:00.000Z",
      "type": 1,
      "description": "O responsável compareceu espontaneamente ao setor. Lavrado o Auto de Notificação nº 115/2026, estabelecendo prazos para regularização documental e estrutural."
    },
    {
      "id": "sys8",
      "denunciation_id": "fec0af56-618d-468b-9869-dc7a64e857d4",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-15T14:15:01.000Z",
      "type": 2,
      "description": "Status alterado de \"Em Andamento\" para \"Notificada\"."
    },
    {
      "id": "rep9",
      "denunciation_id": "779fcf79-b759-4b9b-8481-16c65014bd1a",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T09:20:00.000Z",
      "type": 1,
      "description": "Vistoria de rotina. Localizados 12kg de produtos de origem animal (queijos e linguiças) sem selo de inspeção oficial e procedência desconhecida."
    },
    {
      "id": "sys9",
      "denunciation_id": "779fcf79-b759-4b9b-8481-16c65014bd1a",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T09:21:00.000Z",
      "type": 2,
      "description": "Status alterado de \"Registrada\" para \"Em Andamento\"."
    },
    {
      "id": "rep10",
      "denunciation_id": "779fcf79-b759-4b9b-8481-16c65014bd1a",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T10:45:00.000Z",
      "type": 1,
      "description": "Procedida apreensão imediata e inutilização das mercadorias (Termo 022/2026). Lavrado Auto de Infração Sanitária (AIF) nº 410/2026."
    },
    {
      "id": "sys10",
      "denunciation_id": "779fcf79-b759-4b9b-8481-16c65014bd1a",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T10:46:00.000Z",
      "type": 2,
      "description": "Status alterado de \"Em Andamento\" para \"Em Processo Administrativo\"."
    },
    {
      "id": "rep11",
      "denunciation_id": "779fcf79-b759-4b9b-8481-16c65014bd1a",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T11:00:00.000Z",
      "type": 1,
      "description": "Processo encaminhado ao setor administrativo para instrução e abertura de prazo para defesa prévia."
    },
    {
      "id": "rep12",
      "denunciation_id": "a16a98de-8a83-4ceb-90f0-3cf9bb202f31",
      "user_id": "076ab705-b076-4408-ba1d-caf8ddae5246",
      "createdAt": "2026-04-14T15:30:00.000Z",
      "type": 1,
      "description": "Diligência inicial. Forte odor e sons característicos de suínos nos fundos. Imóvel fechado."
    },
    {
      "id": "sys11",
      "denunciation_id": "a16a98de-8a83-4ceb-90f0-3cf9bb202f31",
      "user_id": "076ab705-b076-4408-ba1d-caf8ddae5246",
      "createdAt": "2026-04-14T15:31:00.000Z",
      "type": 2,
      "description": "Status alterado de \"Registrada\" para \"Em Andamento\"."
    },
    {
      "id": "rep13",
      "denunciation_id": "a16a98de-8a83-4ceb-90f0-3cf9bb202f31",
      "user_id": "076ab705-b076-4408-ba1d-caf8ddae5246",
      "createdAt": "2026-04-15T10:15:00.000Z",
      "type": 1,
      "description": "Contato telefônico com o proprietário. O mesmo só pode atender fora do horário comercial. Aguardando definição da coordenação sobre escala especial/hora extra."
    },
    {
      "id": "rep14",
      "denunciation_id": "a5c70e10-c7d0-476a-9c22-6a9c28d5433b",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-14T13:45:00.000Z",
      "type": 1,
      "description": "Vistoria em lanchonete. Confirmada infiltração e falta de telas. Entregue Termo de Orientação com base na RDC 216."
    },
    {
      "id": "sys12",
      "denunciation_id": "a5c70e10-c7d0-476a-9c22-6a9c28d5433b",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-14T13:46:00.000Z",
      "type": 2,
      "description": "Status alterado de \"Registrada\" para \"Em Andamento\"."
    },
    {
      "id": "rep15",
      "denunciation_id": "a5c70e10-c7d0-476a-9c22-6a9c28d5433b",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-15T09:30:00.000Z",
      "type": 1,
      "description": "Retorno ao local. Verificada instalação de telas, troca de lixeiras e reparo no forro. Adequações realizadas com sucesso. Denúncia encerrada."
    },
    {
      "id": "sys13",
      "denunciation_id": "a5c70e10-c7d0-476a-9c22-6a9c28d5433b",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-15T09:31:00.000Z",
      "type": 2,
      "description": "Status alterado de \"Em Andamento\" para \"Finalizada\"."
    },
    {
      "id": "rep16",
      "denunciation_id": "0a70312c-c700-48d5-b0ac-bf05f7649882",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-14T11:20:00.000Z",
      "type": 1,
      "description": "Visível grande acúmulo de materiais (papelão, PET e carcaças). Vizinhos relatam escorpiões."
    },
    {
      "id": "sys14",
      "denunciation_id": "0a70312c-c700-48d5-b0ac-bf05f7649882",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-14T11:21:00.000Z",
      "type": 2,
      "description": "Status alterado de \"Registrada\" para \"Em Andamento\"."
    },
    {
      "id": "rep17",
      "denunciation_id": "0a70312c-c700-48d5-b0ac-bf05f7649882",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-14T14:00:00.000Z",
      "type": 1,
      "description": "Morador recusou a entrada da equipe e do controle de vetores. Diálogo impossibilitado."
    },
    {
      "id": "sys15",
      "denunciation_id": "0a70312c-c700-48d5-b0ac-bf05f7649882",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-14T14:01:00.000Z",
      "type": 2,
      "description": "Status alterado de \"Em Andamento\" para \"Pendente\"."
    },
    {
      "id": "rep18",
      "denunciation_id": "0a70312c-c700-48d5-b0ac-bf05f7649882",
      "user_id": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-15T08:45:00.000Z",
      "type": 1,
      "description": "Encaminhado memorando ao Jurídico solicitando orientação sobre Mandado Judicial para limpeza compulsória."
    },
    {
      "id": "rep19",
      "denunciation_id": "85dff130-4329-4ea4-b989-1a378e12d411",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-14T10:30:00.000Z",
      "type": 1,
      "description": "Vistoria técnica. Constatados problemas estruturais, telhado com vazamento e infiltrações severas comprometendo a higiene."
    },
    {
      "id": "sys16",
      "denunciation_id": "85dff130-4329-4ea4-b989-1a378e12d411",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-14T10:31:00.000Z",
      "type": 2,
      "description": "Status alterado de \"Registrada\" para \"Em Andamento\"."
    },
    {
      "id": "rep20",
      "denunciation_id": "85dff130-4329-4ea4-b989-1a378e12d411",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T09:15:00.000Z",
      "type": 1,
      "description": "Lavrado o Auto de Notificação nº 152/2026. Concedido prazo de 15 dias para apresentação de cronograma de reformas."
    },
    {
      "id": "sys17",
      "denunciation_id": "85dff130-4329-4ea4-b989-1a378e12d411",
      "user_id": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T09:16:00.000Z",
      "type": 2,
      "description": "Status alterado de \"Em Andamento\" para \"Notificada\"."
    }
  ],

  denuncias: [
    {
      "id": "280f6e1b-24b8-4cfe-840f-d7402d72ba39",
      "registration_type": "MINISTERIO_PUBLICO",
      "title": "Inquérito n° 12/2026 - Verificação de Saneamento",
      "description": "Averiguação solicitada: Inquérito n° 12/2026 - Verificação de Saneamento.",
      "location": {
        "street": "Rua Alagoas",
        "number": "102",
        "district": "Jardim Santa Cecília",
        "city": "Andradina",
        "state": "SP"
      },
      "year": 2026,
      "number": 206,
      "status": "FINALIZADA",
      "userId": "076ab705-b076-4408-ba1d-caf8ddae5246",
      "createdAt": "2026-04-10T09:00:00.000Z",
      "updatedAt": "2026-04-11T10:15:00.000Z"
    },
    {
      "id": "a19fdd59-2a31-4557-a22d-bc74ceb5ce22",
      "registration_type": "TELEFONE",
      "title": "Terreno baldio com água parada em recipientes",
      "description": "Averiguação solicitada: Terreno baldio com água parada em recipientes.",
      "location": {
        "street": "Rua Tiradentes",
        "number": "455",
        "district": "Stella Maris",
        "city": "Andradina",
        "state": "SP"
      },
      "year": 2026,
      "number": 207,
      "status": "EM_PUBLICACAO",
      "userId": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-11T08:30:00.000Z",
      "updatedAt": "2026-04-12T16:20:00.000Z"
    },
    {
      "id": "fec0af56-618d-468b-9869-dc7a64e857d4",
      "registration_type": "OFICIO",
      "title": "Ofício n° 102/2026 - Fiscalização Conjunta de Posturas",
      "description": "Averiguação solicitada: Ofício n° 102/2026 - Fiscalização Conjunta de Posturas.",
      "location": {
        "street": "Rua Corumbá",
        "number": "320",
        "district": "Vila Mineira",
        "city": "Andradina",
        "state": "SP"
      },
      "year": 2026,
      "number": 208,
      "status": "NOTIFICADA",
      "userId": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-12T10:00:00.000Z",
      "updatedAt": "2026-04-13T14:15:00.000Z"
    },
    {
      "id": "779fcf79-b759-4b9b-8481-16c65014bd1a",
      "registration_type": "PRESENCIAL",
      "title": "Venda de produtos de origem animal sem inspeção",
      "description": "Averiguação solicitada: Venda de produtos de origem animal sem inspeção.",
      "location": {
        "street": "Rua Vitório Guaraciaba",
        "number": "940",
        "district": "Centro",
        "city": "Andradina",
        "state": "SP"
      },
      "year": 2026,
      "number": 209,
      "status": "FEITO_AIF",
      "userId": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-13T09:20:00.000Z",
      "updatedAt": "2026-04-13T11:00:00.000Z"
    },
    {
      "id": "a16a98de-8a83-4ceb-90f0-3cf9bb202f31",
      "registration_type": "TELEFONE",
      "title": "Criação de animais (porcos) em perímetro urbano",
      "description": "Averiguação solicitada: Criação de animais (porcos) em perímetro urbano.",
      "location": {
        "street": "Rua Bahia",
        "number": "s/n",
        "district": "Vila Botega",
        "city": "Andradina",
        "state": "SP"
      },
      "year": 2026,
      "number": 210,
      "status": "EM_ANDAMENTO",
      "userId": "076ab705-b076-4408-ba1d-caf8ddae5246",
      "createdAt": "2026-04-13T15:30:00.000Z",
      "updatedAt": "2026-04-14T10:15:00.000Z"
    },
    {
      "id": "a5c70e10-c7d0-476a-9c22-6a9c28d5433b",
      "registration_type": "MINISTERIO_PUBLICO",
      "title": "Denúncia n° 45/2026 - Condições Higiênicas Deficitárias",
      "description": "Averiguação solicitada: Denúncia n° 45/2026 - Condições Higiênicas Deficitárias.",
      "location": {
        "street": "Rua Espírito Santo",
        "number": "15",
        "district": "Jardim Europa",
        "city": "Andradina",
        "state": "SP"
      },
      "year": 2026,
      "number": 211,
      "status": "FINALIZADA",
      "userId": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-14T13:45:00.000Z",
      "updatedAt": "2026-04-15T10:00:00.000Z"
    },
    {
      "id": "0a70312c-c700-48d5-b0ac-bf05f7649882",
      "registration_type": "TELEFONE",
      "title": "Acúmulo de materiais recicláveis em área residencial",
      "description": "Averiguação solicitada: Acúmulo de materiais recicláveis em área residencial.",
      "location": {
        "street": "Rua Bandeirantes",
        "number": "211",
        "district": "Bairro Benfica",
        "city": "Andradina",
        "state": "SP"
      },
      "year": 2026,
      "number": 212,
      "status": "PENDENTE",
      "userId": "1a74f55f-e612-49e2-a1f0-37c1fbea2c47",
      "createdAt": "2026-04-14T11:20:00.000Z",
      "updatedAt": "2026-04-15T08:45:00.000Z"
    },
    {
      "id": "85dff130-4329-4ea4-b989-1a378e12d411",
      "registration_type": "OFICIO",
      "title": "Ofício n° 104/2026 - Solicitação de Vistoria em Imóvel",
      "description": "Averiguação solicitada: Ofício n° 104/2026 - Solicitação de Vistoria em Imóvel.",
      "location": {
        "street": "Rua Marechal Deodoro",
        "number": "88",
        "district": "Vila Passarelli",
        "city": "Andradina",
        "state": "SP"
      },
      "year": 2026,
      "number": 213,
      "status": "NOTIFICADA",
      "userId": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-14T10:30:00.000Z",
      "updatedAt": "2026-04-15T09:15:00.000Z"
    },
    {
      "id": "1f688758-b1ac-469c-9156-38b6c115aee4",
      "registration_type": "PRESENCIAL",
      "title": "Possível vazamento de água em imóvel abandonado",
      "description": "Averiguação solicitada: Vazamento constante no cavalete de imóvel fechado.",
      "location": {
        "street": "Rua J.B. Moraes",
        "number": "450",
        "district": "Vila Mineira",
        "city": "Andradina",
        "state": "SP"
      },
      "year": 2026,
      "number": 214,
      "status": "REGISTRADA",
      "userId": "c7338a9d-5f61-4a79-93a2-f04427cd667e",
      "createdAt": "2026-04-15T07:30:00.000Z",
      "updatedAt": "2026-04-15T07:30:00.000Z"
    },
    {
      "id": "27a66c54-6c9b-4343-8455-123bc9727ece",
      "registration_type": "TELEFONE",
      "title": "Denúncia de descarte de entulho em calçada",
      "description": "Averiguação solicitada: Descarte de entulho obstruindo passagem de pedestres.",
      "location": {
        "street": "Rua Paes Leme",
        "number": "2000",
        "district": "Centro",
        "city": "Andradina",
        "state": "SP"
      },
      "year": 2026,
      "number": 215,
      "status": "REGISTRADA",
      "userId": null,
      "createdAt": "2026-04-15T08:00:00.000Z",
      "updatedAt": "2026-04-15T08:00:00.000Z"
    }
  ]
};

export function runSeed() {
  try {
    localStorage.removeItem(USERS_KEY);
    localStorage.removeItem(REPORTS_KEY);
    localStorage.removeItem(DENUNCIAS_KEY);
    
    localStorage.setItem(USERS_KEY, JSON.stringify(seedData.users));
    localStorage.setItem(REPORTS_KEY, JSON.stringify(seedData.reports));
    localStorage.setItem(DENUNCIAS_KEY, JSON.stringify(seedData.denuncias));
    console.log("Seed executada com sucesso!");
  } catch (error) {
    console.error("Falha ao executar seed:", error);
  }
}