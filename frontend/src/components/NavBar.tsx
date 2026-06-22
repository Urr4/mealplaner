import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate, useLocation } from 'react-router-dom';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'primary.main' }}>
      <Toolbar sx={{ maxWidth: 1200, width: '100%', mx: 'auto', px: { xs: 2, sm: 3 } }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', flexGrow: 1 }}
          onClick={() => navigate('/mealplan')}
        >
          <RestaurantMenuIcon sx={{ fontSize: 28 }} />
          <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, letterSpacing: 0.5 }}>
            Mealplaner
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button color="inherit" startIcon={<RestaurantMenuIcon />} onClick={() => navigate('/recipes')}
            sx={{ fontWeight: isActive('/recipes') ? 700 : 400, borderBottom: isActive('/recipes') ? '2px solid white' : '2px solid transparent', borderRadius: 0, pb: '2px' }}>
            Rezepte
          </Button>
          <Button color="inherit" startIcon={<CalendarMonthIcon />} onClick={() => navigate('/mealplan')}
            sx={{ fontWeight: isActive('/mealplan') ? 700 : 400, borderBottom: isActive('/mealplan') ? '2px solid white' : '2px solid transparent', borderRadius: 0, pb: '2px' }}>
            Wochenplan
          </Button>
          <Button color="inherit" startIcon={<SettingsIcon />} onClick={() => navigate('/settings')}
            sx={{ fontWeight: isActive('/settings') ? 700 : 400, borderBottom: isActive('/settings') ? '2px solid white' : '2px solid transparent', borderRadius: 0, pb: '2px' }}>
            Einstellungen
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
