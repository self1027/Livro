import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Table, Alert } from 'react-bootstrap';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { denunciaRepository } from '../../repository/denunciationRepository';
import { userRepository } from '../../repository/userRepository';
import { DENUNCIATION_STATUS } from '../../constants/denunciations';
import type { Denunciation } from '../../types/denunciation';
import type { User } from '../../types/user';

export default function FiscalArea() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [fiscal, setFiscal] = useState<User | null>(null);
  const [denuncias, setDenuncias] = useState<Denunciation[]>([]);
  
  const selectedStatus = searchParams.get('status') || 'REGISTRADA';

  useEffect(() => {
    if (id) {
      const fiscalData = userRepository.findById(id);
      setFiscal(fiscalData || null);
      
      const allDenuncias = denunciaRepository.search({ 
        userId: id,
        status: selectedStatus === 'ALL' ? '' : selectedStatus 
      });
      setDenuncias(allDenuncias);
    }
  }, [id, selectedStatus]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSearchParams({ status: e.target.value });
  };

  if (!fiscal) return <Container className="mt-4"><Alert variant="danger">Fiscal não encontrado.</Alert></Container>;

  return (
    <Container className="mt-4">
      <hr />
      <Card className="shadow-sm">
        <Card.Header className="bg-light py-3">
          <h2 className="mb-0">Área do Fiscal: {fiscal.name}</h2>
        </Card.Header>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <h4 className="mb-0">Denúncias Atribuídas</h4>
            
            <div className="d-flex align-items-center gap-2">
              <Form.Label className="mb-0 text-nowrap">Filtrar por Status</Form.Label>
              <Form.Select 
                value={selectedStatus} 
                onChange={handleStatusChange}
                style={{ minWidth: '200px' }}
              >
                {Object.entries(DENUNCIATION_STATUS).map(([key, info]) => (
                  <option key={key} value={key}>{info.label}</option>
                ))}
                <option value="ALL">Todos</option>
              </Form.Select>
            </div>
          </div>

          {denuncias.length > 0 ? (
            <div className="table-responsive">
              <Table striped hover className="align-middle">
                <thead className="table-dark">
                  <tr>
                    <th>Nº</th>
                    <th>Título</th>
                    <th>Endereço</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {denuncias.map(denuncia => {
                    const statusInfo = DENUNCIATION_STATUS[denuncia.status as keyof typeof DENUNCIATION_STATUS] || 
                                       { label: 'Desconhecido', color: '#ccc' };
                    return (
                      <tr key={denuncia.id}>
                        <td className="fw-bold">{denuncia.year}/{denuncia.number}</td>
                        <td>{denuncia.title}</td>
                        <td className="small">
                          {denuncia.location.street}, {denuncia.location.number}<br />
                          <span className="text-muted">{denuncia.location.district}</span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div style={{ 
                              width: '5px', 
                              height: '25px', 
                              backgroundColor: statusInfo.color, 
                              marginRight: '8px', 
                              borderRadius: '2px' 
                            }}></div>
                            <span className="fw-bold small">{statusInfo.label}</span>
                          </div>
                        </td>
                        <td>
                          <Link to={`/denuncias/${denuncia.id}`} className="btn btn-sm btn-primary">
                            <i className="fas fa-eye me-1"></i> Ver
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          ) : (
            <Alert variant="info">Nenhuma denúncia encontrada para este filtro.</Alert>
          )}
        </Card.Body>
      </Card>
      <br />
    </Container>
  );
}