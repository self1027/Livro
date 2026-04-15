import { useState, useEffect } from 'react';
import { Container, Card, Table, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { denunciaRepository } from '../../repository/denunciationRepository';
import { userRepository } from '../../repository/userRepository'; // Importado
import { DENUNCIATION_STATUS, DenunciationSenderLabel } from '../../constants/denunciations';
import type { Denunciation } from '../../types/denunciation';

export default function Home() {
  const [denuncias, setDenuncias] = useState<Denunciation[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const step = 10;

  useEffect(() => {
    const data = denunciaRepository.findAll();
    setDenuncias(data);
  }, []);

  const handleCarregarMais = () => {
    setVisibleCount(prev => prev + step);
  };

  const denunciasVisiveis = denuncias.slice(0, visibleCount);
  const temMais = visibleCount < denuncias.length;

  return (
    <Container className="mt-4">
      <hr />
      <Card className="shadow-sm">
        <Card.Header className="bg-white py-3">
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="mb-0">Listagem de Denúncias</h2>
            <Link to="/buscar" className="btn btn-success">
              <i className="fas fa-search me-2"></i>Buscar Denúncias
            </Link>
          </div>
        </Card.Header>
        <Card.Body>
          {denuncias.length > 0 ? (
            <>
              <div className="table-responsive">
                <Table striped hover id="tabela-denuncias" className="align-middle">
                  <thead className="table-dark">
                    <tr>
                      <th>Ano/Nº</th>
                      <th>Tipo</th>
                      <th>Título</th>
                      <th>Endereço</th>
                      <th>Data</th>
                      <th>Status</th>
                      <th>Fiscal</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {denunciasVisiveis.map((denuncia) => {
                      const statusInfo = DENUNCIATION_STATUS[denuncia.status as keyof typeof DENUNCIATION_STATUS] || 
                                         { label: 'Desconhecido', color: '#ccc' };
                      const fiscal = denuncia.userId ? userRepository.findById(denuncia.userId) : null;

                      return (
                        <tr key={denuncia.id}>
                          <td>{denuncia.year}/{denuncia.number}</td>
                          <td>{DenunciationSenderLabel[denuncia.registration_type as keyof typeof DenunciationSenderLabel]}</td>
                          <td>{denuncia.title}</td>
                          <td>
                            <small>
                              {denuncia.location.street}, {denuncia.location.number}<br />
                              <span className="text-muted">{denuncia.location.district}</span>
                            </small>
                          </td>
                          <td>{new Date(denuncia.createdAt).toLocaleDateString('pt-BR')}</td>
                          <td>
                            <div className="d-flex align-items-center">
                              <div 
                                style={{ 
                                  width: '5px', 
                                  height: '25px', 
                                  backgroundColor: statusInfo.color, 
                                  marginRight: '8px', 
                                  borderRadius: '2px' 
                                }} 
                              />
                              <span className="fw-bold" style={{ fontSize: '0.85rem' }}>
                                {statusInfo.label}
                              </span>
                            </div>
                          </td>
                          <td>
                            {fiscal ? (
                              <Badge bg="info" className="text-dark fw-normal">
                                <i className="fas fa-user-tie me-1"></i>
                                {fiscal.name}
                              </Badge>
                            ) : (
                              <span className="text-muted small italic">Não atribuído</span>
                            )}
                          </td>
                          <td>
                            <Link to={`/denuncias/${denuncia.id}`} className="btn btn-sm btn-primary text-nowrap">
                              <i className="fas fa-eye me-1"></i> Ver
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              <div className="text-center mt-3">
                <Button 
                  variant="outline-primary" 
                  onClick={handleCarregarMais}
                  disabled={!temMais}
                >
                  {temMais ? 'Carregar mais' : 'Todas as denúncias foram carregadas'}
                </Button>
              </div>
            </>
          ) : (
            <div className="alert alert-info shadow-sm">
              <i className="fas fa-info-circle me-2"></i>
              Nenhuma denúncia encontrada no sistema.
            </div>
          )}
        </Card.Body>
      </Card>
      <br />
    </Container>
  );
}