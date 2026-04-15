import { Link } from 'react-router-dom'
import { Navbar, Nav, NavDropdown, Container } from 'react-bootstrap'

export default function MyNavbar() {
  return (
    <Navbar expand="lg" variant="dark" bg="primary" className="shadow-sm py-1">
      <Container fluid>
        
        <Navbar.Brand as={Link} to="/" className="fw-bold">
          <i className="fas fa-book me-2"></i>
          Livro VISA Andradina
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/denuncias/new" className="mx-2">
              <i className="fas fa-plus-circle me-1"></i>
              Nova Denúncia
            </Nav.Link>
          </Nav>

          <Nav className="ms-auto">
            <Nav className="ms-auto">
              <Nav.Link 
                as={Link} 
                to="/area-fiscal" 
                className="mx-2 d-flex align-items-center"
              >
                <i className="fas fa-user-shield me-1"></i> Área do Fiscal
              </Nav.Link>
            </Nav>

            <NavDropdown 
              title={<span><i className="fas fa-cogs me-1"></i> Administrativo</span>} 
              id="nav-dropdown-admin"
              className="mx-2"
              align="end"
            >
              <NavDropdown.Item as={Link} to="/admin">
                <i className="fas fa-tachometer-alt me-2"></i> Painel Administrativo
              </NavDropdown.Item>
              
              <NavDropdown.Divider />
              
              <NavDropdown.Item as={Link} to="/cadastro/usuario">
                <i className="fas fa-user-plus me-2"></i> Gerenciar Fiscais
              </NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/atribuir">
                <i className="fas fa-tasks me-2"></i> Atribuir Fiscal
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}