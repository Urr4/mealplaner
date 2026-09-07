import { Tabs, Tab, Box } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

/** Sub-navigation shown at the top of the recipe pages, switching between the
 * normal recipe list and the "Zusammengesetzte Rezepte" (composed recipes) tab. */
export default function RecipeSectionTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const value = location.pathname.startsWith('/recipes/composed') ? 1 : 0;

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Tabs
        value={value}
        onChange={(_, newValue) => navigate(newValue === 1 ? '/recipes/composed' : '/recipes')}
        variant="fullWidth"
      >
        <Tab label="Rezepte" />
        <Tab label="Zusammengesetzte Rezepte" />
      </Tabs>
    </Box>
  );
}
