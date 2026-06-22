import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import NavBar from './components/NavBar';
import RecipeListPage from './pages/RecipeListPage';
import RecipeFormPage from './pages/RecipeFormPage';
import MealPlanPage from './pages/MealPlanPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <NavBar />
      <Routes>
        <Route path="/" element={<Navigate to="/mealplan" replace />} />
        <Route path="/recipes" element={<RecipeListPage />} />
        <Route path="/recipes/new" element={<RecipeFormPage />} />
        <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
        <Route path="/mealplan" element={<MealPlanPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Box>
  );
}


