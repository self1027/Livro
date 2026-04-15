import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Row, Col, Button, Modal, ListGroup, Badge } from 'react-bootstrap';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { denunciaRepository } from '../../repository/denunciationRepository';
import { userRepository } from '../../repository/userRepository';
import { reportRepository } from '../../repository/reportRepository';
import { DENUNCIATION_STATUS, DenunciationSenderLabel } from '../../constants/denunciations';
import type { Denunciation } from '../../types/denunciation';
import type { User } from '../../types/user';
import type { Report } from '../../types/report';

export default function ViewDenunciation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [denuncia, setDenuncia] = useState<Denunciation | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [showFiscalModal, setShowFiscalModal] = useState(false);
  const [newReport, setNewReport] = useState('');
  const [statusTemp, setStatusTemp] = useState('');
  const [fiscais, setFiscais] = useState<User[]>([]);
  const [selectedFiscalId, setSelectedFiscalId] = useState('');

  const loadData = () => {
    if (id) {
      const data = denunciaRepository.findById(id);
      if (data) {
        setDenuncia(data);
        setStatusTemp(data.status);
        setSelectedFiscalId(data.userId || '');
        const reportsData = reportRepository.findByDenunciation(id);
        setReports(reportsData);
      } else {
        navigate('/');
      }
    }
  };

  useEffect(() => {
    loadData();
    setFiscais(userRepository.findAll());
  }, [id]);

  if (!denuncia) return null;

  const statusInfo = DENUNCIATION_STATUS[denuncia.status as keyof typeof DENUNCIATION_STATUS] || 
                     { label: 'Desconhecido', color: '#ccc' };

  const fiscalAtual = denuncia.userId ? userRepository.findById(denuncia.userId) : null;

  const handleAssignFiscal = () => {
    if (id && selectedFiscalId) {
      denunciaRepository.update(id, { userId: selectedFiscalId });
      setShowFiscalModal(false);
      loadData();
    }
  };

  const handleAddReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !denuncia) return;

    const statusAnterior = denuncia.status;
    const houveMudancaStatus = statusTemp && statusAnterior !== statusTemp;
    const userId = denuncia.userId || 'admin';

    if (newReport.trim()) {
      reportRepository.save({
        description: newReport.trim(),
        denunciation_id: id,
        user_id: userId,
        type: 1 
      });
    }

    if (houveMudancaStatus) {
      const labelAnterior = DENUNCIATION_STATUS[statusAnterior as keyof typeof DENUNCIATION_STATUS]?.label || statusAnterior;
      const labelNovo = DENUNCIATION_STATUS[statusTemp as keyof typeof DENUNCIATION_STATUS]?.label || statusTemp;

      reportRepository.save({
        description: `Status alterado de "${labelAnterior}" para "${labelNovo}"`,
        denunciation_id: id,
        user_id: userId,
        type: 2 
      });

      denunciaRepository.update(id, { status: statusTemp });
    }

    if (!newReport.trim() && !houveMudancaStatus) {
      alert("Nada para atualizar");
      return;
    }
    
    setNewReport('');
    loadData();
  };

  const handleDeleteReport = (reportId: string) => {
    if (window.confirm('Deseja realmente excluir este relatório?')) {
      reportRepository.delete(reportId);
      loadData();
    }
  };

  return (
    <Container className="mt-4">
      <hr />

      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-light">
          <h2 className="mb-0">Visualizar Denúncia</h2>
        </Card.Header>

        <Card.Body>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Label className="small text-muted">Ano do Registro</Form.Label>
              <Form.Control type="number" value={denuncia.year} readOnly className="bg-light" />
            </Col>
            <Col md={6}>
              <Form.Label className="small text-muted">Número da Denúncia</Form.Label>
              <Form.Control type="number" value={denuncia.number} readOnly className="bg-light" />
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={6}>
              <Form.Label className="small text-muted">Origem da Denúncia</Form.Label>
              <Form.Control value={DenunciationSenderLabel[denuncia.registration_type as keyof typeof DenunciationSenderLabel]} readOnly className="bg-light" />
            </Col>
            <Col md={6}>
              <Form.Label className="small text-muted">Título da Denúncia</Form.Label>
              <Form.Control type="text" value={denuncia.title} readOnly className="bg-light" />
            </Col>
          </Row>

          <Row className="mb-3">
            <Col md={6} className="mb-2">
              <Form.Label className="small text-muted">Nome da Rua</Form.Label>
              <Form.Control value={denuncia.location.street} readOnly className="bg-light" />
            </Col>
            <Col md={3} className="mb-2">
              <Form.Label className="small text-muted">Número</Form.Label>
              <Form.Control value={denuncia.location.number} readOnly className="bg-light" />
            </Col>
            <Col md={3} className="mb-2">
              <Form.Label className="small text-muted">Complemento</Form.Label>
              <Form.Control value={denuncia.location.complement || ''} readOnly className="bg-light" />
            </Col>
          </Row>

          <div className="mb-3">
            <Form.Label className="small text-muted">Bairro</Form.Label>
            <Form.Control value={denuncia.location.district} readOnly className="bg-light" />
          </div>

          <div className="mb-3">
            <Form.Label className="small text-muted">Descrição Detalhada</Form.Label>
            <Form.Control as="textarea" rows={5} value={denuncia.description} readOnly className="bg-light" />
          </div>

          <div className="mb-3">
            <Form.Label className="small text-muted">Data de Registro</Form.Label>
            <Form.Control value={new Date(denuncia.createdAt).toLocaleDateString('pt-BR')} readOnly className="bg-light" />
          </div>

          <div className="mb-3 d-flex align-items-center">
            <div style={{ width: '5px', height: '25px', backgroundColor: statusInfo.color, marginRight: '8px', borderRadius: '2px' }}></div>
            <span className="fw-bold text-dark">{statusInfo.label}</span>
          </div>

          <div className="mb-3">
            <Form.Label className="small text-muted">Fiscal Responsável</Form.Label><br />
            {fiscalAtual ? (
              <Badge bg="info" className="text-dark py-2 px-3 fw-normal">
                <i className="fas fa-user-tie me-2"></i>{fiscalAtual.name}
              </Badge>
            ) : (
              <span><i className="fas fa-user-slash me-2"></i>Não atribuído</span>
            )}
          </div>

          <div className="d-flex justify-content-between mt-4 mb-2">
            <Button variant="secondary" onClick={() => navigate('/')}>
              <i className="fas fa-arrow-left me-2"></i> Voltar
            </Button>
            <div>
              <Link to={`/denuncias/${denuncia.id}/edit`} className="btn btn-primary me-2">
                <i className="fas fa-edit me-2"></i> Editar
              </Link>
              <Button variant="warning" onClick={() => setShowFiscalModal(true)}>
                <i className="fas fa-user-plus me-2"></i> {denuncia.userId ? 'Alterar Fiscal' : 'Atribuir Fiscal'}
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-4 shadow-sm" id="reports-section">
        <Card.Header>
          <h3 className="mb-0">Relatórios Associados</h3>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleAddReport}>
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Adicionar Relatório</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={4} 
                placeholder="Digite o relatório..." 
                className="shadow-sm"
                value={newReport}
                onChange={(e) => setNewReport(e.target.value)}
              />
            </Form.Group>
            
            <div className="d-flex justify-content-between align-items-end mb-4 gap-3">
              <div style={{ flexGrow: 1, maxWidth: '300px' }}>
                <Form.Label className="fw-bold">Atualizar Status</Form.Label>
                <Form.Select value={statusTemp} onChange={(e) => setStatusTemp(e.target.value)}>
                  {Object.entries(DENUNCIATION_STATUS).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </Form.Select>
              </div>
              <Button type="submit" variant="success" className="px-4">
                Salvar Alterações
              </Button>
            </div>
          </Form>

          <ListGroup variant="flush" className="border-top">
            {reports.length > 0 ? (
              /* .slice().reverse() garante que a lista exiba do mais antigo (baixo da pilha) para o mais novo */
              reports.slice().reverse().map(report => (
                <ListGroup.Item key={report.id} className={`py-3 mb-2 rounded border ${report.type === 2 ? 'bg-white italic' : 'bg-light'}`}>
                  <div className="d-flex justify-content-between mb-2">
                    <div>
                      <Badge bg={report.type === 2 ? "info" : "secondary"} className="fw-normal me-2">
                        {report.type === 2 ? 'SISTEMA' : new Date(report.createdAt).toLocaleString('pt-BR')}
                      </Badge>
                      <small className="text-muted">
                        <b>Fiscal:</b> {userRepository.findById(report.user_id)?.name || 'Desconhecido'}
                      </small>
                    </div>
                    <div>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="text-primary p-0 me-3"
                        onClick={() => navigate(`/relatorio/${report.id}/edit`)}
                      >
                        <i className="fas fa-edit"></i> Editar
                      </Button>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="text-danger p-0"
                        onClick={() => handleDeleteReport(report.id)}
                      >
                        <i className="fas fa-trash"></i> Excluir
                      </Button>
                    </div>
                  </div>
                  <p className={`mb-0 ${report.type === 2 ? 'text-muted small' : ''}`} style={{ whiteSpace: 'pre-wrap' }}>
                    {report.type === 2 && <i className="fas fa-history me-2"></i>}
                    {report.description}
                  </p>
                </ListGroup.Item>
              ))
            ) : (
              <ListGroup.Item className="text-muted italic border-0">
                Nenhum relatório registrado para esta denúncia.
              </ListGroup.Item>
            )}
          </ListGroup>
        </Card.Body>
      </Card>

      <Modal show={showFiscalModal} onHide={() => setShowFiscalModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Selecionar Fiscal</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Select 
            className="shadow-sm" 
            value={selectedFiscalId} 
            onChange={(e) => setSelectedFiscalId(e.target.value)}
          >
            <option value="">Selecione um fiscal...</option>
            {fiscais.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Form.Select>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFiscalModal(false)}>Cancelar</Button>
          <Button variant="warning" onClick={handleAssignFiscal} disabled={!selectedFiscalId}>
            Confirmar Atribuição
          </Button>
        </Modal.Footer>
      </Modal>

      <br />
    </Container>
  );
}