import { useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Box, BottomNavigation, BottomNavigationAction, Paper, useMediaQuery, useTheme } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import NavBar from './components/NavBar';
import RecipeListPage from './pages/RecipeListPage';
import RecipeFormPage from './pages/RecipeFormPage';
import RecipeViewPage from './pages/RecipeViewPage';
import MealPlanPage from './pages/MealPlanPage';
import SettingsPage from './pages/SettingsPage';

const SWIPE_PAGES = ['/mealplan', '/recipes'];

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const touchStartX = useRef<number>(0);

  const currentPageIndex = SWIPE_PAGES.findIndex(p => location.pathname.startsWith(p));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) < 60) return;
    if (diff > 0 && currentPageIndex < SWIPE_PAGES.length - 1) {
      navigate(SWIPE_PAGES[currentPageIndex + 1]);
    } else if (diff < 0 && currentPageIndex > 0) {
      navigate(SWIPE_PAGES[currentPageIndex - 1]);
    }
  };

  return (
    <Box
      sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: isMobile ? '56px' : 0 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <NavBar />
      <Routes>
        <Route path="/" element={<Navigate to="/mealplan" replace />} />
        <Route path="/mealplan" element={<MealPlanPage />} />
        <Route path="/recipes" element={<RecipeListPage />} />
        <Route path="/recipes/new" element={<RecipeFormPage />} />
        <Route path="/recipes/:id" element={<RecipeViewPage />} />
        <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>

      {isMobile && (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }} elevation={3}>
          <BottomNavigation
            value={currentPageIndex === -1 ? false : currentPageIndex}
            onChange={(_, newValue) => navigate(SWIPE_PAGES[newValue])}
          >
            <BottomNavigationAction label="Wochenplan" icon={<CalendarMonthIcon />} />
            <BottomNavigationAction label="Rezepte" icon={<RestaurantMenuIcon />} />
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}

export default function App() {
  return <AppContent />;
}



