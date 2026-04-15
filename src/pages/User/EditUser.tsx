import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { userRepository } from '../../repository/userRepository';

export default function EditUser() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const user = userRepository.findById(id);
      if (user) {
        setName(user.name);
        setIsActive(user.isActive);
        setLoading(false);
      } else {
        alert('Usuário não encontrado');
        navigate('/cadastro/usuario');
      }
    }
  }, [id, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('O nome do usuário não pode estar vazio.');
      return;
    }

    if (id) {
      userRepository.update(id, {
        name: name,
        isActive: isActive
      });

      alert('Usuário atualizado com sucesso!');
      navigate('/cadastro/usuario');
    }
  };

  if (loading) return null;

  return (
    <Container className="mt-4">
      <hr />
      <Card className="shadow-sm">
        <Card.Header className="bg-light">
          <h2 className="mb-0">Editar Usuário</h2>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label htmlFor="name">Nome do Usuário</Form.Label>
              <Form.Control
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Check 
                type="checkbox"
                id="active"
                label={isActive ? 'Desativar Usuário' : 'Ativar Usuário'}
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            </Form.Group>

            <div className="d-flex gap-2">
              <Button variant="primary" type="submit">
                Salvar Alterações
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => navigate('/cadastro/usuario')}
              >
                Cancelar
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
      <br />
    </Container>
  );
}