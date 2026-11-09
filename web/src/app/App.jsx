import { Routes, Route, Link } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { DashboardPage } from "../pages/DashboardPage.jsx";
import { NewWeighingPage } from "../pages/NewWeighingPage.jsx";
import { WeighingsPage } from "../pages/WeighingsPage.jsx";
import { WeighingDetailPage } from "../pages/WeighingDetailPage.jsx";
import { ResourcesPage } from "../pages/ResourcesPage.jsx";
import { ProfilePage } from "../pages/ProfilePage.jsx";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="pesagens/nova" element={<NewWeighingPage />} />
        <Route path="pesagens" element={<WeighingsPage />} />
        <Route path="pesagens/:id" element={<WeighingDetailPage />} />
        <Route
          path="agencias"
          element={<ResourcesPage resource="agencies" title="Agências" />}
        />
        <Route
          path="usuarios"
          element={
            <ResourcesPage resource="users" title="Usuários" access="users" />
          }
        />
        <Route
          path="parceiros"
          element={
            <ResourcesPage resource="partners" title="Parceiros" access="all" />
          }
        />
        <Route
          path="tipos-parceiros"
          element={
            <ResourcesPage
              resource="partner-types"
              title="Tipos de parceiros"
            />
          }
        />
        <Route
          path="residuos"
          element={
            <ResourcesPage resource="residue-types" title="Tipos de resíduos" />
          }
        />
        <Route path="relatorios" element={<WeighingsPage report />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route
          path="*"
          element={
            <section className="panel">
              <h1>Página não encontrada</h1>
              <Link to="/">Voltar ao início</Link>
            </section>
          }
        />
      </Route>
    </Routes>
  );
}
