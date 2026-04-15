import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'

// Importação das páginas
import NewDenunciation from './pages/Denunciation/NewDenunciation'

export default function App() {
  return (
    <>
      <Navbar />

      {/* O <main> com a classe do index.css (flex: 1) 
        garante que o conteúdo empurre o footer para baixo 
      */}
      <main className="container mt-4 mb-5">
        <Routes>
          {/* Página Inicial */}
          <Route path="/" element={<Home />} />

          {/* Rota de Denúncias */}
          <Route path="/denuncias/new" element={<NewDenunciation />} />

          {/* Rota 404 - Caso o usuário acesse um link inexistente */}
          <Route path="*" element={
            <div className="container text-center mt-5">
              <h2>404</h2>
              <p>Página não encontrada.</p>
            </div>
          } />
        </Routes>
      </main>

      <Footer />
    </>
  )
}