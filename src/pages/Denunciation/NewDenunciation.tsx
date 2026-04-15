import React, { useState } from 'react';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { DenunciationSender, DenunciationSenderLabel } from '../../constants/denunciations';
import { denunciaRepository } from '../../repository/denunciationRepository';
import type { CreateDenunciationDTO } from '../../types/denunciation';

export default function NewDenunciation() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<CreateDenunciationDTO>({
    registration_type: '',
    title: '',
    description: '',
    location: {
      street: '',
      number: '',
      complement: '',
      district: '',
      city: 'Andradina',
      state: 'SP',
    },
  });

  const [validated, setValidated] = useState(false);
  const [showCapsWarning, setShowCapsWarning] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const capsOn = e.getModifierState && e.getModifierState('CapsLock');
    if (capsOn && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setShowCapsWarning(true);
    } else {
      setShowCapsWarning(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Lógica para atualizar campos aninhados (location.xxx)
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof CreateDenunciationDTO] as object),
          [child]: value,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    event.preventDefault();

    if (form.checkValidity() === false) {
      event.stopPropagation();
      setValidated(true);
      return;
    }

    // SALVAMENTO VIA REPOSITORY
    try {
      denunciaRepository.save(formData);
      alert('Denúncia cadastrada com sucesso!');
      navigate('/'); // Redireciona para a listagem
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar a denúncia localmente.');
    }
  };

  return (
    <Container className="mt-4">
      <hr />
      <Card className="shadow-sm">
        <Card.Header className="bg-light">
          <h2 className="mb-0">Cadastrar Denúncia</h2>
        </Card.Header>
        
        <Card.Body>
          {showCapsWarning && (
            <Alert variant="danger" id="capsLockAlert">
              Caps Lock está ativado. Digitação bloqueada nos campos de texto.
            </Alert>
          )}

          <Form noValidate validated={validated} onSubmit={handleSubmit} id="denunciaForm">
            
            {/* Origem da Denúncia */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Origem da Denúncia</Form.Label>
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
              <Form.Label className="fw-bold">Título</Form.Label>
              <Form.Control
                required
                type="text"
                name="title"
                placeholder="Ex: Galinhas na Mineira"
                onKeyDown={handleKeyDown}
                onChange={handleInputChange}
              />
              <Form.Text className="text-muted">
                Um título breve e descritivo para identificar a denúncia.
              </Form.Text>
            </Form.Group>

            {/* Endereço Estruturado */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Endereço do Local</Form.Label>
              <Form.Control
                required
                className="mb-2"
                type="text"
                name="location.street"
                placeholder="Nome da Rua (sem 'Rua', 'Av.', etc.)"
                onKeyDown={handleKeyDown}
                onChange={handleInputChange}
              />
              <Form.Control
                required
                className="mb-2"
                type="text"
                name="location.number"
                placeholder="Número da Casa"
                onChange={handleInputChange}
              />
              <Form.Control
                className="mb-2"
                type="text"
                name="location.complement"
                placeholder="Complemento (opcional)"
                onKeyDown={handleKeyDown}
                onChange={handleInputChange}
              />
              
              <Form.Control
                required
                type="text"
                name="location.district"
                placeholder="Bairro"
                onKeyDown={handleKeyDown}
                onChange={handleInputChange}
              />
              <Form.Text className="text-muted">
                Informe o bairro onde ocorre a situação.
              </Form.Text>
            </Form.Group>

            {/* Descrição */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Descrição da Denúncia</Form.Label>
              <Form.Control
                required
                as="textarea"
                rows={4}
                name="description"
                placeholder="Descreva os detalhes da situação..."
                onKeyDown={handleKeyDown}
                onChange={handleInputChange}
              />
              <Form.Text className="text-muted">
                Descreva com o máximo de detalhes possíveis o que está acontecendo no local.
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="outline-secondary" onClick={() => navigate('/')}>
                Cancelar
              </Button>
              <Button variant="success" type="submit">
                <i className="fas fa-save me-2"></i> Cadastrar Denúncia
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
      <br />
    </Container>
  );
}