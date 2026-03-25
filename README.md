# Livro

Sistema de gerenciamento para a Vigilância Sanitária de Andradina, projetado para a digitalização, monitoramento e arquivamento de denúncias, inspeções e processos administrativos.

## Funcionalidades

### Gestão de Denúncias
* **Fluxo de Registro:** Entrada de dados com categorização por tipo de origem (Presencial, Telefone, Ofício).
* **Protocolo Automático:** Geração de numeração sequencial vinculada ao ano corrente.
* **Georreferenciamento:** Vinculação obrigatória a bairros cadastrados para análise de áreas de risco.

### Fiscalização e Acompanhamento
* **Distribuição de Carga:** Atribuição de fiscais responsáveis por cada processo.
* **Linha do Tempo (Reports):** Registro de histórico para cada denúncia, permitindo rastrear mudanças de status e observações técnicas.
* **Status Workflow:** Ciclo de vida da denúncia (Registrada, Em Andamento, Notificada, Finalizada, etc).

### Inteligência e Auxiliares
* **Dashboard Administrativo:** Agregação de dados em tempo real para visualização de produtividade e manchas de calor (bairros com mais ocorrências).
* **AIF Helper:** Repositório digital de leis (Decretos Estaduais e Leis Municipais) com assistente para preenchimento de autos de infração.
* **Exportação PDF:** Geração de relatórios formatados para impressão e uso em vistorias externas.

## Arquitetura de Software

O projeto utiliza o padrão de arquitetura em camadas para garantir a separação de responsabilidades:

1.  **Camada de Rotas (Controllers):** Gerencia as requisições HTTP, valida parâmetros de entrada e seleciona a View ou Resposta JSON adequada.
2.  **Camada de Serviço (Services):** Contém a lógica de negócio, como o cálculo de estatísticas de BI, geração de slugs e validações complexas.
3.  **Camada de Acesso a Dados (Repositories):** Interface direta com o Sequelize para operações de CRUD, isolando a complexidade das queries.
4.  **Camada de Modelo (Models):** Definição das entidades do banco de dados e seus relacionamentos (Associações 1:N entre Usuários/Denúncias e Denúncias/Relatórios).

## Tecnologias

* **Runtime:** Node.js
* **Framework:** Express.js
* **ORM:** Sequelize
* **Template Engine:** EJS
* **Estilização:** Bootstrap 4.6.2
* **Documentação:** OpenAPI 3.0 / Swagger
* **Geração de Documentos:** PDFKit

## Instalação

1.  **Dependências:**
    ```bash
    npm install
    ```

2.  **Banco de Dados:**
    Certifique-se de que o PostgreSQL/MariaDB esteja rodando e configure as credenciais no diretório `src/database`.

3.  **Execução:**
    ```bash
    npm start
    ```

## Documentação da API

A documentação técnica detalhada dos endpoints, schemas de dados e parâmetros de consulta pode ser acessada em:
`http://localhost/docs`

Os módulos documentados incluem:
* `users.yaml`: Gestão de fiscais e acesso.
* `denunciations.yaml`: Operações principais de denúncias.
* `districts.yaml`: Gerenciamento de bairros.
* `admin.yaml`: Endpoints de agregação para o Dashboard.

## Estrutura de Diretórios

```text
├── docs/           # Especificações OpenAPI (YAML)
├── public/         # Ativos estáticos (CSS, JS, Imagens, Leis JSON)
├── src/
│   ├── constants/  # Enums e definições de status
│   ├── controllers/# Controladores de rota
│   ├── database/   # Configuração de conexão
│   ├── models/     # Definições de tabelas/entidades
│   ├── repositories/# Queries e persistência
│   ├── services/   # Lógica de negócio
│   └── utils/      # Helpers (PDF, Query Builders)
└── views/          # Templates EJS divididos por módulos
```

## Licença

Este projeto está licenciado sob a Licença MIT - consulte o arquivo [LICENSE](LICENSE) para detalhes.