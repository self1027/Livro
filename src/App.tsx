import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'

import NewDenunciation from './pages/Denunciation/NewDenunciation'
import ViewDenunciation from './pages/Denunciation/ViewDenunciation'
import EditDenunciation from './pages/Denunciation/EditDenunciation'
import SearchDenunciation from './pages/Denunciation/SearchDenunciation'
import EditReport from './pages/Report/EditReport'

import NewUser from './pages/User/NewUser'
import EditUser from './pages/User/EditUser'
import AssignUser from './pages/Denunciation/AssignUser'
import ListUser from './pages/User/ListUser'
import PannelUser from './pages/User/PannelUser'

import AdminDashboard from './pages/Admin/AdminDashboard'

export default function App() {
  return (
    <>
      <Navbar />

      <main className="container mt-4 mb-5">
        <Routes>

          <Route path="/" element={<Home />} />

          <Route path="/denuncias/new" element={<NewDenunciation />} />

          <Route path="/buscar" element={<SearchDenunciation />} />

          <Route path="/denuncias/:id" element={<ViewDenunciation />} />

          <Route path="/denuncias/:id/edit" element={<EditDenunciation />} />

          <Route path="/relatorio/:id/edit" element={<EditReport />} />

          <Route path="/atribuir" element={<AssignUser />} />

          <Route path="/cadastro/usuario" element={<NewUser />} />

          <Route path="/editar-usuario/:id" element={<EditUser />} />

          <Route path="/area-fiscal" element={<ListUser />} />

          <Route path="/area-fiscal/:id" element={<PannelUser />} />

          <Route path="/admin" element={<AdminDashboard />} />

          {/* Rota 404 */}
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