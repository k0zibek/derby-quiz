import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import TeacherPage from "./pages/TeacherPage";
import JoinPage from "./pages/JoinPage";
import ScreenPage from "./pages/ScreenPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/teacher" replace />} />
        <Route path="/teacher" element={<TeacherPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/screen/:code" element={<ScreenPage />} />
      </Routes>
    </BrowserRouter>
  );
}
