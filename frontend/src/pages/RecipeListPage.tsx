import { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, TextField, Grid, Button,
  InputAdornment, CircularProgress, Alert, Fab
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import GrassIcon from '@mui/icons-material/Grass';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import type { Recipe } from '../types';
import { getRecipes, deleteRecipe } from '../api/client';
import RecipeCard from '../components/RecipeCard';

export default function RecipeListPage() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [nameQuery, setNameQuery] = useState('');
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRecipes(
        nameQuery.trim() || undefined,
        ingredientQuery.trim() || undefined,
      );
      setRecipes(data);
    } catch {
      setError('Rezepte konnten nicht geladen werden. Läuft der Server?');
    } finally {
      setLoading(false);
    }
  }, [nameQuery, ingredientQuery]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Rezept wirklich löschen?')) return;
    try {
      await deleteRecipe(id);
      setRecipes(prev => prev.filter(r => r.id !== id));
    } catch {
      setError('Rezept konnte nicht gelöscht werden.');
    }
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100vh - 64px)' }}>
      <Box
        sx={{
          background: 'linear-gradient(135deg, #E8440A 0%, #F5A623 100%)',
          py: { xs: 4, md: 6 },
          px: 2,
          textAlign: 'center',
        }}
      >
        <Typography variant="h3" sx={{ color: 'white', mb: 1 }}>
          Deine Rezepte
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', mb: 3 }}>
          Nach Rezeptname oder Zutat suchen
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, maxWidth: 760, mx: 'auto', flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            fullWidth
            placeholder="Rezeptname suchen…"
            value={nameQuery}
            onChange={e => setNameQuery(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'primary.main' }} /></InputAdornment> } }}
            sx={{ bgcolor: 'white', borderRadius: 2, '& fieldset': { border: 'none' } }}
          />
          <TextField
            fullWidth
            placeholder="Nach Zutat filtern…"
            value={ingredientQuery}
            onChange={e => setIngredientQuery(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><GrassIcon sx={{ color: 'secondary.main' }} /></InputAdornment> } }}
            sx={{ bgcolor: 'white', borderRadius: 2, '& fieldset': { border: 'none' } }}
          />
        </Box>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : recipes.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h2" sx={{ fontSize: 64, mb: 2 }}>🍳</Typography>
            <Typography variant="h5" color="text.secondary" sx={{ mb: 1 }}>
              Keine Rezepte gefunden
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Lege dein erstes Rezept an!
            </Typography>
            <Button variant="contained" onClick={() => navigate('/recipes/new')}>
              Rezept anlegen
            </Button>
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {recipes.length} Rezept{recipes.length !== 1 ? 'e' : ''} gefunden
            </Typography>
            <Grid container spacing={3}>
              {recipes.map(recipe => (
                <Grid key={recipe.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <RecipeCard
                    recipe={recipe}
                    onEdit={id => navigate(`/recipes/${id}/edit`)}
                    onDelete={handleDelete}
                  />
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </Container>

      <Fab
        color="primary"
        aria-label="Rezept hinzufügen"
        onClick={() => navigate('/recipes/new')}
        sx={{ position: 'fixed', bottom: 32, right: 32 }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}
