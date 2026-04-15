import React, { useState, useEffect } from 'react';
import { Container, Card, Table, Form, Button, Alert } from 'react-bootstrap';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { denunciaRepository } from '../../repository/denunciationRepository';
import { userRepository } from '../../repository/userRepository';
import type { Denunciation } from '../../types/denunciation';
import type { User } from '../../types/user';
import { DenunciationSenderLabel } from '../../constants/denunciations';

export default function AssignUser() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const denunciaId = searchParams.get('denunciaId');

  const [denuncias, setDenuncias] = useState<Denunciation[]>([]);
  const [fiscais, setFiscais] = useState<User[]>([]);
  const [selectedFiscal, setSelectedFiscal] = useState('');
  const [denunciaSelecionada, setDenunciaSelecionada] = useState<Denunciation | null>(null);

  useEffect(() => {
    const todasDenuncias = denunciaRepository.findAll();
    const pendentes = todasDenuncias.filter(d => 
      !d.userId && d.status !== 'FINALIZADA'
    );

    setDenuncias(pendentes);
    setFiscais(userRepository.findActive());

    if (denunciaId) {
      const encontrada = denunciaRepository.findById(denunciaId);
      if (encontrada && encontrada.status !== 'FINALIZADA') {
        setDenunciaSelecionada(encontrada);
      } else {
        setDenunciaSelecionada(null);
      }
    } else {
      setDenunciaSelecionada(null);
    }
  }, [denunciaId]);

  const handleConfirmarAtribuicao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!denunciaId || !selectedFiscal) return;

    // No seu repositório, criamos o assignUser anteriormente
    denunciaRepository.update(denunciaId, { userId: selectedFiscal });
    
    alert('Fiscal atribuído com sucesso!');
    navigate('/atribuir'); // Volta para a lista
  };

  return (
    <Container className="mt-4">
      <hr />
      <Card className="shadow-sm">
        <Card.Header className="bg-light">
          <h2 className="mb-0">
            {denunciaSelecionada ? 'Indicar Fiscal' : 'Atribuir Denúncias a Fiscais'}
          </h2>
        </Card.Header>

        <Card.Body>
          {denunciaSelecionada ? (
            /* --- MODO FORMULÁRIO --- */
            <Form onSubmit={handleConfirmarAtribuicao}>
              <div className="mb-3">
                <p><strong>Denúncia:</strong> {denunciaSelecionada.year}/{denunciaSelecionada.number} - {denunciaSelecionada.title}</p>
                <p>
                  <strong>Endereço:</strong> {denunciaSelecionada.location.street}, {denunciaSelecionada.location.number} - {denunciaSelecionada.location.district}
                </p>
                <p><strong>Data:</strong> {new Date(denunciaSelecionada.createdAt).toLocaleDateString('pt-BR')}</p>
              </div>

              <Form.Group className="mb-4">
                <Form.Label className="fw-bold">Selecionar Fiscal</Form.Label>
                <Form.Select 
                  required 
                  value={selectedFiscal}
                  onChange={(e) => setSelectedFiscal(e.target.value)}
                >
                  <option value="">Selecione um fiscal...</option>
                  {fiscais.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <div className="d-flex justify-content-between">
                <Button variant="outline-secondary" onClick={() => navigate('/atribuir')}>
                  Voltar
                </Button>
                <Button type="submit" variant="primary">
                  Confirmar Atribuição
                </Button>
              </div>
            </Form>
          ) : (
            /* --- MODO LISTA --- */
            <>
              {denuncias.length > 0 ? (
                <div className="table-responsive">
                  <Table striped hover align="center">
                    <thead>
                      <tr>
                        <th>Nº</th>
                        <th>Título</th>
                        <th>Endereço</th>
                        <th>Data</th>
                        <th>Origem</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {denuncias.map(denuncia => (
                        <tr key={denuncia.id}>
                          <td>{denuncia.year}/{denuncia.number}</td>
                          <td>{denuncia.title}</td>
                          <td>
                            {denuncia.location.street}, {denuncia.location.number}<br/>
                            <small className="text-muted">{denuncia.location.district}</small>
                          </td>
                          <td>{new Date(denuncia.createdAt).toLocaleDateString('pt-BR')}</td>
                          <td>{DenunciationSenderLabel[denuncia.registration_type as keyof typeof DenunciationSenderLabel]}</td>
                          <td>
                            <div className="d-flex gap-2">
                              <Link 
                                to={`/atribuir?denunciaId=${denuncia.id}`} 
                                className="btn btn-sm btn-primary"
                              >
                                Atribuir Fiscal
                              </Link>
                              <Link 
                                to={`/denuncias/${denuncia.id}`} 
                                className="btn btn-sm btn-secondary"
                              >
                                Ver
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <Alert variant="info">
                  Nenhuma denúncia pendente de atribuição.
                </Alert>
              )}
            </>
          )}
        </Card.Body>
      </Card>
      <br />
    </Container>
  );
}