import React, { useState, useRef, useEffect } from 'react';
import { Container, Card, Form, Row, Col, Button, Table, Alert, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { denunciaRepository } from '../../repository/denunciationRepository';
import { userRepository } from '../../repository/userRepository'; // Importado
import type { Denunciation } from '../../types/denunciation';
import type { User } from '../../types/user'; // Importado
import { DENUNCIATION_STATUS, DenunciationSender, DenunciationSenderLabel } from '../../constants/denunciations';

export default function SearchDenunciation() {
  const [results, setResults] = useState<Denunciation[] | null>(null);
  const [fiscais, setFiscais] = useState<User[]>([]); // Estado para os fiscais
  const resultsRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState({
    year: '',
    number: '',
    street: '',
    houseNumber: '',
    district: '',
    status: '',
    registration_type: '',
    userId: ''
  });

  // Carrega os fiscais ao montar o componente
  useEffect(() => {
    setFiscais(userRepository.findAll());
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ 
      ...prev, 
      [name]: value 
    }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const hasFilter = Object.values(filters).some(value => value.trim() !== '');
    if (!hasFilter) {
      alert('Por favor, preencha ao menos um campo para buscar.');
      return;
    }

    const data = denunciaRepository.search(filters);
    setResults(data);

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <Container className="mt-4">
      <hr />
      <Card className="shadow-sm">
        <Card.Header className="bg-light">
          <h2 className="mb-0">Buscar Denúncias</h2>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSearch}>
            <Row>
              <Col md={4} className="mb-3">
                <Form.Label>Ano</Form.Label>
                <Form.Control name="year" value={filters.year} onChange={handleInputChange} placeholder="Ex: 2024" />
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Número</Form.Label>
                <Form.Control name="number" value={filters.number} onChange={handleInputChange} placeholder="Ex: 15" />
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Fiscal Responsável</Form.Label>
                <Form.Select name="userId" value={filters.userId} onChange={handleInputChange}>
                  <option value="">Todos os Fiscais</option>
                  {fiscais.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </Form.Select>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Endereço (Rua/Avenida)</Form.Label>
              <Form.Control name="street" value={filters.street} onChange={handleInputChange} placeholder="Nome da rua" />
            </Form.Group>

            <Row>
              <Col md={6} className="mb-3">
                <Form.Label>Número do Endereço</Form.Label>
                <Form.Control name="houseNumber" value={filters.houseNumber} onChange={handleInputChange} />
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label>Bairro</Form.Label>
                <Form.Control name="district" value={filters.district} onChange={handleInputChange} />
              </Col>
            </Row>

            <Row>
              <Col md={6} className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Select name="status" value={filters.status} onChange={handleInputChange}>
                  <option value="">Todos os Status</option>
                  {Object.entries(DENUNCIATION_STATUS).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label>Origem</Form.Label>
                <Form.Select name="registration_type" value={filters.registration_type} onChange={handleInputChange}>
                  <option value="">Todas as Origens</option>
                  {Object.entries(DenunciationSender).map(([key, value]) => (
                    <option key={key} value={value}>{DenunciationSenderLabel[value]}</option>
                  ))}
                </Form.Select>
              </Col>
            </Row>

            <Button variant="success" type="submit" className="px-4">
              <i className="fas fa-search me-2"></i> Buscar
            </Button>
          </Form>
        </Card.Body>
      </Card>

      <div ref={resultsRef}>
        {results && results.length > 0 && (
          <Card className="mt-4 shadow-sm">
            <Card.Header className="bg-dark text-white">
              <h3 className="mb-0 h5">Resultados da Busca ({results.length})</h3>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive striped hover className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Ano/Nº</th>
                    <th>Título</th>
                    <th>Endereço</th>
                    <th>Status</th>
                    <th>Fiscal</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(denuncia => {
                    const statusInfo = DENUNCIATION_STATUS[denuncia.status as keyof typeof DENUNCIATION_STATUS] || { label: 'Desconhecido', color: '#ccc' };
                    // Busca o nome do fiscal para cada linha
                    const fiscal = denuncia.userId ? userRepository.findById(denuncia.userId) : null;

                    return (
                      <tr key={denuncia.id}>
                        <td>{denuncia.year}/{denuncia.number}</td>
                        <td>{denuncia.title}</td>
                        <td className="small">
                          {denuncia.location.street}, {denuncia.location.number}<br/>
                          <span className="text-muted">{denuncia.location.district}</span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div style={{ width: '4px', height: '20px', backgroundColor: statusInfo.color, marginRight: '8px', borderRadius: '2px' }}></div>
                            <span className="fw-bold small">{statusInfo.label}</span>
                          </div>
                        </td>
                        <td>
                          {fiscal ? (
                            <Badge bg="info" className="text-dark fw-normal">
                              {fiscal.name}
                            </Badge>
                          ) : (
                            <span className="text-muted small">Não atribuído</span>
                          )}
                        </td>
                        <td>
                          <Link to={`/denuncias/${denuncia.id}`} className="btn btn-sm btn-primary">
                            <i className="fas fa-eye"></i>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        )}

        {results && results.length === 0 && (
          <Alert variant="info" className="mt-4">
            Nenhuma denúncia encontrada com os critérios especificados.
          </Alert>
        )}
      </div>
      <br />
    </Container>
  );
}