import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { userRepository } from '../../repository/userRepository';
import type { User } from '../../types/user';

export default function NewUser() {
  const [userName, setUserName] = useState('');
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    const data = userRepository.findAll();
    setUsers(data);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    if (!userName.trim()) {
      alert('Por favor, defina o nome do usuário.');
      return;
    }

    userRepository.save({
      name: userName,
      isActive: true
    });

    setUserName('');
    loadUsers();
    alert('Usuário cadastrado com sucesso!');
  };

  return (
    <Container className="mt-4">
      <hr />
      
      <Card className="shadow-sm mb-4">
        <Card.Header className="bg-light">
          <h2 className="mb-0">Novo Usuário</h2>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleRegister}>
            <Form.Group className="mb-3">
              <Form.Control
                type="text"
                placeholder="Defina o nome do Usuário"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </Form.Group>
            <Button variant="success" type="submit">
              Cadastrar
            </Button>
          </Form>
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Header className="bg-light">
          <h2 className="mb-0">Listagem de Usuários</h2>
        </Card.Header>
        <Card.Body>
          {users.length === 0 ? (
            <p className="text-muted text-center">Nenhum usuário cadastrado.</p>
          ) : (
            users.map((user) => (
              <div 
                key={user.id} 
                className="d-flex align-items-center mb-2 p-2 border rounded bg-light shadow-sm"
              >
                <div className="d-flex align-items-center flex-grow-1">
                  <span
                    className="rounded-circle"
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: user.isActive ? '#28a745' : '#dc3545',
                      display: 'inline-block'
                    }}
                    title={user.isActive ? 'Ativo' : 'Inativo'}
                  ></span>
                  
                  <div className="ms-3 fw-bold">
                    {user.name}
                  </div>
                </div>

                <Link 
                  to={`/editar-usuario/${user.id}`} 
                  className="btn btn-warning btn-sm"
                >
                  <i className="fas fa-edit me-1"></i> Editar
                </Link>
              </div>
            ))
          )}
        </Card.Body>
      </Card>
      <br />
    </Container>
  );
}