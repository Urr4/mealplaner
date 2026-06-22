import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate, useLocation } from 'react-router-dom';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);

  const navBtn = (label: string, path: string, icon: React.ReactNode) => (
    <Button
      color="inherit"
      startIcon={icon}
      onClick={() => navigate(path)}
      sx={{
        fontWeight: isActive(path) ? 700 : 400,
        borderBottom: isActive(path) ? '2px solid white' : '2px solid transparent',
        borderRadius: 0,
        pb: '2px',
      }}
    >
      {label}
    </Button>
  );

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

        {/* Desktop nav — hidden on mobile (bottom nav takes over) */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
          {navBtn('Wochenplan', '/mealplan', <CalendarMonthIcon />)}
          {navBtn('Rezepte', '/recipes', <RestaurantMenuIcon />)}
          {navBtn('Einstellungen', '/settings', <SettingsIcon />)}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
