import { useState, useEffect } from 'react';
import { Modal, Button, Badge } from 'react-bootstrap';

export default function IntroModal() {
  const [show, setShow] = useState(false);
  
  // Constante de 7 dias em milissegundos
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const STORAGE_KEY = '@visa-andradina:last-seen-intro';

  useEffect(() => {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();

    // Se nunca viu OU se a última vez foi há mais de 7 dias
    if (!lastSeen || (now - Number(lastSeen) > SEVEN_DAYS_MS)) {
      setShow(true);
    }
  }, []);

  const handleClose = (updateStorage = false) => {
    if (updateStorage) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }
    setShow(false);
  };

  return (
    <Modal show={show} onHide={() => handleClose(false)} size="lg" centered backdrop="static">
      {/* Cabeçalho mais imersivo */}
      <Modal.Header className="bg-dark text-white border-0 p-4" style={{
        background: 'linear-gradient(135deg, #212529 0%, #343a40 100%)',
        borderBottom: '2px solid #0d6efd'
      }}>
        <Modal.Title className="d-flex align-items-center">
          <div className="bg-primary rounded-circle p-2 me-3 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
            <i className="fas fa-microchip fa-xs"></i>
          </div>
          <div>
            <span className="d-block fw-bold">Projeto Livro</span>
            <small className="text fs-6 fw-normal">Documentação Técnica & Demonstração</small>
          </div>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-4">
        {/* CONTEXTO */}
        <div className="mb-4">
          <h5 className="fw-semibold mb-2 text-dark">
            <i className="fas fa-info-circle me-2 text-primary"></i>Contexto
          </h5>
          <p className="text-muted mb-2">
            Sistema desenvolvido para a <strong>Vigilância Sanitária de Andradina (SP)</strong>,
            com foco na digitalização e rastreabilidade de denúncias e processos administrativos.
          </p>

          <div className="d-flex flex-wrap gap-2 mt-3">
             <span className="badge border text-dark fw-normal"><i className="fas fa-route me-1 text-primary"></i> Workflow de Status</span>
             <span className="badge border text-dark fw-normal"><i className="fas fa-history me-1 text-primary"></i> Timeline de Eventos</span>
             <span className="badge border text-dark fw-normal"><i className="fas fa-chart-pie me-1 text-primary"></i> Análise Geo-Bairros</span>
          </div>
        </div>

        {/* AMBIENTE */}
        <div className="row g-3">
          <div className="col-md-6">
            <div className="p-3 border rounded h-100 shadow-sm">
              <h6 className="fw-bold mb-3 text-uppercase small text-primary">Ambiente de Produção</h6>
              <ul className="list-unstyled small mb-0">
                <li className="mb-2"><i className="fas fa-code me-2 text-secondary"></i>Node.js / Express / Sequelize</li>
                <li className="mb-2"><i className="fas fa-database me-2 text-secondary"></i>MariaDB / MySQL</li>
                <li><i className="fas fa-server me-2 text-secondary"></i>Ubuntu Server (Intranet)</li>
              </ul>
            </div>
          </div>

          <div className="col-md-6">
            <div className="p-3 border rounded h-100 bg-light shadow-sm">
              <h6 className="fw-bold mb-3 text-uppercase small text-secondary">Esta Demonstração</h6>
              <ul className="list-unstyled small mb-0">
                <li className="mb-2">
                  <Badge bg="secondary" className="me-2">Local</Badge>
                  Persistência via LocalStorage
                </li>
                <li className="mb-2">
                  <Badge bg="secondary" className="me-2">Static</Badge>
                  Execução Client-side (Vite)
                </li>
                <li>
                  <Badge bg="secondary" className="me-2">Mock</Badge>
                  Dataset populado via Seed
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* NOTA TÉCNICA */}
        <div className="mt-4 p-3 bg-light rounded border-start border-3 border-primary">
          <p className="small mb-0 text-muted">
            <strong>Nota técnica:</strong> Esta versão é um espelho funcional para portfólio. No ambiente institucional, 
            o sistema integra-se com barramentos de dados governamentais.
          </p>
        </div>
      </Modal.Body>

      <Modal.Footer className="bg-light border-0 p-3">
        <Button variant="primary" onClick={() => handleClose(true)} className="px-5 fw-bold shadow-sm">
          Acessar Sistema
        </Button>
      </Modal.Footer>
    </Modal>
  );
}