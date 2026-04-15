import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { reportRepository } from '../../repository/reportRepository';
import { denunciaRepository } from '../../repository/denunciationRepository';
import { DENUNCIATION_STATUS } from '../../constants/denunciations';
import type { Report } from '../../types/report';
import type { Denunciation } from '../../types/denunciation';

export default function EditReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<Report | null>(null);
  const [denuncia, setDenuncia] = useState<Denunciation | null>(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      const reportData = reportRepository.findById(id);
      if (reportData) {
        setReport(reportData);
        setDescription(reportData.description);
        
        const denunciationData = denunciaRepository.findById(reportData.denunciation_id);
        if (denunciationData) {
          setDenuncia(denunciationData);
          setStatus(denunciationData.status); // Inicializa com o status atual da denúncia
        }
      } else {
        navigate('/');
      }
    }
  }, [id, navigate]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!report || !denuncia) return;

    try {
      let finalDescription = description;

      // Lógica do Service: Se for mudança de status, gera a descrição automática
      if (report.type === 2) {
        const labelNew = DENUNCIATION_STATUS[status as keyof typeof DENUNCIATION_STATUS]?.label || status;
        finalDescription = `Status alterado para "${labelNew}"`;
      }

      // 1. Atualiza o relatório
      reportRepository.update(report.id, { 
        description: finalDescription 
      });

      // 2. Se mudou o status no Select, atualiza a denúncia pai (conforme seu editReport service)
      if (status !== denuncia.status) {
        denunciaRepository.update(denuncia.id, { status });
      }

      navigate(`/denuncias/${denuncia.id}`);
    } catch (err) {
      setError('Erro ao atualizar o relatório.');
    }
  };

  if (!report || !denuncia) return null;

  return (
    <Container className="mt-4">
      <hr />
      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="shadow-sm">
        <Card.Header>
          <h2 className="mb-0">Editar Relatório</h2>
        </Card.Header>
        <Card.Body>
          <div className="mb-4 bg-light p-3 rounded">
            <p className="mb-1"><strong>Denúncia:</strong> {denuncia.year}/{denuncia.number} - {denuncia.title}</p>
            <p className="mb-1"><strong>Endereço:</strong> {denuncia.location.street}, {denuncia.location.number} - {denuncia.location.district}</p>
            <p className="mb-0"><strong>Data da Denúncia:</strong> {new Date(denuncia.createdAt).toLocaleDateString('pt-BR')}</p>
          </div>

          <Form onSubmit={handleSave}>
            {/* Se o tipo for 1 (TEXTO LIBRE) */}
            {report.type === 1 && (
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Descrição do Relatório</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </Form.Group>
            )}

            {/* Se o tipo for 2 (ALTERAÇÃO DE STATUS) */}
            {report.type === 2 && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Descrição Atual (Auditoria)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={report.description}
                    readOnly
                    className="bg-light"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Alterar Status da Denúncia</Form.Label>
                  <Form.Select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)}
                    required
                  >
                    {Object.entries(DENUNCIATION_STATUS).map(([key, info]) => (
                      <option key={key} value={key}>{info.label}</option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Ao salvar, a denúncia será atualizada para este novo status.
                  </Form.Text>
                </Form.Group>
              </>
            )}

            <div className="d-flex justify-content-between mt-4">
              <Button variant="secondary" onClick={() => navigate(`/denuncias/${denuncia.id}`)}>
                Voltar
              </Button>
              <Button type="submit" variant="primary">
                Salvar Alterações
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}