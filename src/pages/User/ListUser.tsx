import { useState, useEffect } from 'react';
import { Container, Card, Table, Button, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { userRepository } from '../../repository/userRepository';
import type { User } from '../../types/user';

export default function FiscalList() {
  const [fiscais, setFiscais] = useState<User[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const data = userRepository.findAll();
    setFiscais(data);
  }, []);

  const handleEntrar = (id: string) => {
    navigate(`/area-fiscal/${id}?status=REGISTRADA`);
  };

  return (
    <Container className="mt-4">
      <hr />
      <Card className="shadow-sm">
        <Card.Header className="bg-white py-3">
          <h2 className="mb-0">Listagem de Fiscais</h2>
        </Card.Header>
        <Card.Body>
          {fiscais.length > 0 ? (
            <div className="table-responsive">
              <Table striped hover className="align-middle">
                <thead className="table-dark">
                  <tr>
                    <th>ID</th>
                    <th>Nome</th>
                    <th style={{ width: '150px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {fiscais.map((fiscal) => (
                    <tr key={fiscal.id}>
                      <td className="text-muted small">#{fiscal.id.substring(0, 8)}</td>
                      <td className="fw-bold">{fiscal.name}</td>
                      <td>
                        <Button 
                          variant="success" 
                          size="sm" 
                          onClick={() => handleEntrar(fiscal.id)}
                          className="d-flex align-items-center"
                        >
                          <i className="fas fa-sign-in-alt me-2"></i> Entrar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <Alert variant="info" className="d-flex align-items-center">
              <i className="fas fa-info-circle me-2"></i>
              Nenhum fiscal encontrado no sistema.
            </Alert>
          )}
        </Card.Body>
      </Card>
      <br />
    </Container>
  );
}