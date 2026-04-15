import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Row, Col, Button } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { denunciaRepository } from '../../repository/denunciationRepository';
import { DenunciationSender, DenunciationSenderLabel } from '../../constants/denunciations';
import type { Denunciation } from '../../types/denunciation';

export default function EditDenunciation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<Denunciation | null>(null);
  const [validated, setValidated] = useState(false);

  // Carrega os dados da denúncia ao iniciar
  useEffect(() => {
    if (id) {
      const data = denunciaRepository.findById(id);
      if (data) {
        setFormData(data);
      } else {
        navigate('/');
      }
    }
  }, [id, navigate]);

  if (!formData) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => prev ? ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof Denunciation] as object),
          [child]: value,
        },
      }) : null);
    } else {
      setFormData((prev) => prev ? ({ ...prev, [name]: value }) : null);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    if (form.checkValidity() === false) {
      event.stopPropagation();
      setValidated(true);
      return;
    }

    if (id && formData) {
      denunciaRepository.update(id, formData);
      alert('Alterações salvas com sucesso!');
      navigate(`/denuncias/${id}`);
    }
  };

  return (
    <Container className="mt-4">
      <hr />
      <Card className="shadow-sm">
        <Card.Header className="bg-light">
          <h2 className="mb-0">Editar Denúncia</h2>
        </Card.Header>
        
        <Card.Body>
          <Form noValidate validated={validated} onSubmit={handleSubmit}>
            {/* Ano e Número (Readonly) */}
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Ano</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.year}
                    readOnly
                    className="bg-light"
                  />
                  <Form.Text className="text-muted">
                    Ano em que a denúncia está sendo registrada.
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Número da Denúncia</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.number}
                    readOnly
                    className="bg-light"
                  />
                  <Form.Text className="text-muted">
                    Número sequencial gerado automaticamente.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            {/* Origem */}
            <Form.Group className="mb-3">
              <Form.Label>Origem da Denúncia</Form.Label>
              <Form.Select
                required
                name="registration_type"
                value={formData.registration_type}
                onChange={handleInputChange}
              >
                {Object.entries(DenunciationSender).map(([key, value]) => (
                  <option key={key} value={value}>
                    {DenunciationSenderLabel[value]}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Informe como a denúncia foi recebida (telefone, presencialmente ou ofício).
              </Form.Text>
            </Form.Group>

            {/* Título */}
            <Form.Group className="mb-3">
              <Form.Label>Título</Form.Label>
              <Form.Control
                required
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
              />
              <Form.Text className="text-muted">
                Um título breve e descritivo para identificar a denúncia.
              </Form.Text>
            </Form.Group>

            {/* Endereço */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Endereço do Local</Form.Label>
              <Form.Control
                required
                className="mb-2"
                type="text"
                name="location.street"
                value={formData.location.street}
                onChange={handleInputChange}
                placeholder="Nome da Rua"
              />
              <Form.Control
                required
                className="mb-2"
                type="text"
                name="location.number"
                value={formData.location.number}
                onChange={handleInputChange}
                placeholder="Número"
              />
              <Form.Control
                className="mb-2"
                type="text"
                name="location.complement"
                value={formData.location.complement || ''}
                onChange={handleInputChange}
                placeholder="Complemento"
              />
              <Form.Control
                required
                type="text"
                name="location.district"
                value={formData.location.district}
                onChange={handleInputChange}
                placeholder="Bairro"
              />
              <Form.Text className="text-muted">
                Informe apenas o nome da rua ou avenida, <strong>sem prefixos</strong> e <strong>evite abreviações</strong>.
              </Form.Text>
            </Form.Group>

            {/* Descrição */}
            <Form.Group className="mb-3">
              <Form.Label>Descrição da Denúncia</Form.Label>
              <Form.Control
                required
                as="textarea"
                rows={4}
                name="description"
                value={formData.description}
                onChange={handleInputChange}
              />
              <Form.Text className="text-muted">
                Descreva com o máximo de detalhes possíveis o que está acontecendo no local.
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-between mt-4">
              <Button variant="secondary" onClick={() => navigate(`/denuncias/${id}`)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit">
                Salvar Alterações
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
      <br />
    </Container>
  );
}