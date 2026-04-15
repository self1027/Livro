import { useState, useMemo } from 'react';
import { Container, Card, Row, Col, Form, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';
import { denunciaRepository } from '../../repository/denunciationRepository';
import { DENUNCIATION_STATUS } from '../../constants/denunciations';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, ArcElement, Title, Tooltip, Legend
);

export default function AdminDashboard() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [denuncias] = useState(denunciaRepository.findAll());

  // 1. ANOS DISPONÍVEIS (Extraídos das denúncias)
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(denuncias.map(d => d.year)));
    return years.length > 0 ? years.sort((a, b) => b - a) : [new Date().getFullYear()];
  }, [denuncias]);

  // 2. FILTRAR DADOS PELO ANO
  const filteredData = useMemo(() => {
    return denuncias.filter(d => d.year === selectedYear);
  }, [denuncias, selectedYear]);

  // 3. ESTATÍSTICAS (CARDS)
  const stats = useMemo(() => {
    type ValidStatus = "REGISTRADA" | "PENDENTE" | "FINALIZADA";

    const statusEmAndamento: ValidStatus[] = [
      DENUNCIATION_STATUS.REGISTRADA.slug as ValidStatus,
      DENUNCIATION_STATUS.PENDENTE.slug as ValidStatus,
      DENUNCIATION_STATUS.FINALIZADA.slug as ValidStatus
    ];

    return {
      total: filteredData.length,
      andamento: filteredData.filter(d => 
        statusEmAndamento.includes(d.status as ValidStatus)
      ).length,
      
      resolvidas: filteredData.filter(d => 
        d.status === (DENUNCIATION_STATUS.FINALIZADA.slug as ValidStatus)
      ).length,
      
      semFiscal: filteredData.filter(d => !d.userId).length,
    };
  }, [filteredData]);

  // 4. DADOS PARA OS GRÁFICOS
  const chartsData = useMemo(() => {
    // Meses
    const months = new Array(12).fill(0);
    filteredData.forEach(d => {
      const month = new Date(d.createdAt).getMonth();
      months[month]++;
    });

    // Status
    const statusCounts = Object.keys(DENUNCIATION_STATUS).map(key => ({
      label: DENUNCIATION_STATUS[key as keyof typeof DENUNCIATION_STATUS].label,
      count: filteredData.filter(d => d.status === key).length,
      color: DENUNCIATION_STATUS[key as keyof typeof DENUNCIATION_STATUS].color
    }));

    // Bairros (Top 5)
    const bairroMap: Record<string, number> = {};
    filteredData.forEach(d => {
      const b = d.location.district;
      bairroMap[b] = (bairroMap[b] || 0) + 1;
    });
    const topBairros = Object.entries(bairroMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { months, statusCounts, topBairros };
  }, [filteredData]);

  return (
    <Container className="mt-4 pb-5">
      <hr />
      <Card className="shadow-sm">
        <Card.Header className="bg-light py-3">
          <h2 className="mb-0">Painel Administrativo</h2>
        </Card.Header>
        <Card.Body>
          
          {/* FILTRO ANO */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <h4 className="mb-0">Visão Geral das Denúncias</h4>
            <div className="d-flex align-items-center gap-2">
              <Form.Label className="mb-0 fw-bold">Ano</Form.Label>
              <Form.Select 
                style={{ width: '120px' }}
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </Form.Select>
            </div>
          </div>

          {/* CARDS */}
          <Row className="mb-4 g-3">
            {[
              { label: 'Total de Denúncias', val: stats.total, color: 'primary' },
              { label: 'Em Andamento', val: stats.andamento, color: 'warning' },
              { label: 'Resolvidas', val: stats.resolvidas, color: 'success' },
              { label: 'Sem Fiscal', val: stats.semFiscal, color: 'danger' },
            ].map((card, i) => (
              <Col md={3} key={i}>
                <Card className={`border-${card.color} text-center shadow-xs`}>
                  <Card.Body>
                    <h6 className="text-muted">{card.label}</h6>
                    <h3 className={`text-${card.color} fw-bold`}>{card.val}</h3>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>

          {/* GRÁFICO MÊS (LINE) */}
          <Card className="mb-4 shadow-sm">
            <Card.Header><h5>Denúncias por Mês</h5></Card.Header>
            <Card.Body style={{ height: '300px' }}>
              <Line 
                options={{ responsive: true, maintainAspectRatio: false }}
                data={{
                  labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
                  datasets: [{
                    label: 'Denúncias',
                    data: chartsData.months,
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    tension: 0.3,
                    fill: true
                  }]
                }} 
              />
            </Card.Body>
          </Card>

          <Row className="mb-4">
            {/* STATUS (PIE) */}
            <Col md={6}>
              <Card className="h-100 shadow-sm">
                <Card.Header><h5>Denúncias por Status</h5></Card.Header>
                <Card.Body style={{ height: '300px' }}>
                  <Pie 
                    options={{ responsive: true, maintainAspectRatio: false }}
                    data={{
                      labels: chartsData.statusCounts.map(s => s.label),
                      datasets: [{
                        data: chartsData.statusCounts.map(s => s.count),
                        backgroundColor: chartsData.statusCounts.map(s => s.color)
                      }]
                    }}
                  />
                </Card.Body>
              </Card>
            </Col>

            {/* BAIRROS (BAR) */}
            <Col md={6}>
              <Card className="h-100 shadow-sm">
                <Card.Header><h5>Top Bairros</h5></Card.Header>
                <Card.Body style={{ height: '300px' }}>
                  <Bar 
                    options={{ responsive: true, maintainAspectRatio: false }}
                    data={{
                      labels: chartsData.topBairros.map(b => b[0]),
                      datasets: [{
                        label: 'Denúncias',
                        data: chartsData.topBairros.map(b => b[1]),
                        backgroundColor: '#198754'
                      }]
                    }}
                  />
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* ÚLTIMAS DENÚNCIAS (Substituindo a tabela de relatórios para maior utilidade) */}
          <Card className="shadow-sm">
            <Card.Header><h5>Últimas Denúncias Registradas</h5></Card.Header>
            <div className="table-responsive">
              <Table striped hover className="mb-0">
                <tbody>
                  {filteredData.slice(0, 5).map(d => (
                    <tr key={d.id}>
                      <td className="ps-3">
                        <b>{d.number}/{d.year}</b><br />
                        <small className="text-muted">{d.title}</small>
                      </td>
                      <td className="text-end pe-3 align-middle">
                        <Link to={`/denuncias/${d.id}`} className="btn btn-sm btn-outline-primary">Ver</Link>
                      </td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr><td className="text-center p-4 text-muted">Nenhuma denúncia para o ano selecionado.</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>

        </Card.Body>
      </Card>
    </Container>
  );
}