import { Container } from 'react-bootstrap';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer bg-dark text-white py-3 mt-auto w-100">
      <Container className="text-center">
        <div className="mb-2">
          <strong>Murilo D.</strong> –{' '}
          <span className="dev-role">Desenvolvedor Back-End</span>
        </div>

        <div className="social-icons mb-2">
          <a href="https://github.com/self1027" target="_blank" rel="noopener noreferrer" className="text-light text-decoration-none mx-2" aria-label="GitHub">
            <i className="fab fa-github fa-lg"></i>
          </a>
          <a href="https://www.linkedin.com/in/murilo-dias-dev/" target="_blank" rel="noopener noreferrer" className="text-light text-decoration-none mx-2" aria-label="LinkedIn">
            <i className="fab fa-linkedin fa-lg"></i>
          </a>
          <a href="https://www.murilod.dev/" target="_blank" rel="noopener noreferrer" className="text-light mx-2" aria-label="Portfólio">
            <i className="fas fa-globe fa-lg"></i>
          </a>
        </div>

        <small>© {currentYear} Murilo D. Todos os direitos reservados.</small>

        <div className="mt-2">
          <small className="text-muted">
            <a href="https://www.flaticon.com/free-icons/read" title="read icons" className="text-muted text-decoration-none" target="_blank" rel="noopener noreferrer">
              Ícone do livro criado por Freepik - Flaticon
            </a>
          </small>
        </div>
      </Container>

      <style>{`
        .dev-role::after {
          content: "";
          margin-left: 6px;
          transition: all 0.2s ease;
        }

        .dev-role:hover::after {
          content: " 🤡";
        }
      `}</style>
    </footer>
  );
}