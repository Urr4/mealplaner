import { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, TextField, Grid, Button,
  InputAdornment, CircularProgress, Alert, Fab, useMediaQuery, useTheme,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControlLabel, Checkbox, Stack, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import GrassIcon from '@mui/icons-material/Grass';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useNavigate } from 'react-router-dom';
import type { Recipe } from '../types';
import { getRecipes, deleteRecipe } from '../api/client';
import { buildRecipesPdf } from '../utils/recipePdf';
import RecipeCard from '../components/RecipeCard';
import RecipeSectionTabs from '../components/RecipeSectionTabs';

export default function RecipeListPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [nameQuery, setNameQuery] = useState('');
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

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

  const handleOpenExport = () => {
    setSelectedIds(new Set(recipes.map(r => r.id)));
    setExportDialogOpen(true);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === recipes.length ? new Set() : new Set(recipes.map(r => r.id)));
  };

  const handleExport = async () => {
    const selected = recipes.filter(r => selectedIds.has(r.id));
    if (!selected.length) return;
    setExporting(true);
    try {
      await buildRecipesPdf(selected, { includeImage: true });
      setExportDialogOpen(false);
    } catch {
      setError('PDF konnte nicht erstellt werden.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100vh - 64px)' }}>
      <RecipeSectionTabs />
      {/* Hero / search — compact on mobile */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #E8440A 0%, #F5A623 100%)',
          py: { xs: 2, md: 6 },
          px: 2,
          textAlign: 'center',
        }}
      >
        {!isMobile && (
          <>
            <Typography variant="h3" sx={{ color: 'white', mb: 1 }}>Deine Rezepte</Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', mb: 3 }}>
              Nach Rezeptname oder Zutat suchen
            </Typography>
          </>
        )}
        <Box sx={{ display: 'flex', gap: 1, maxWidth: 760, mx: 'auto', flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            fullWidth
            size={isMobile ? 'small' : 'medium'}
            placeholder="Rezeptname…"
            value={nameQuery}
            onChange={e => setNameQuery(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'primary.main' }} /></InputAdornment> } }}
            sx={{ bgcolor: 'white', borderRadius: 2, '& fieldset': { border: 'none' } }}
          />
          <TextField
            fullWidth
            size={isMobile ? 'small' : 'medium'}
            placeholder="Nach Zutat…"
            value={ingredientQuery}
            onChange={e => setIngredientQuery(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><GrassIcon sx={{ color: 'secondary.main' }} /></InputAdornment> } }}
            sx={{ bgcolor: 'white', borderRadius: 2, '& fieldset': { border: 'none' } }}
          />
        </Box>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, sm: 3 } }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : recipes.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h2" sx={{ fontSize: 64, mb: 2 }}>🍳</Typography>
            <Typography variant="h5" color="text.secondary" sx={{ mb: 1 }}>Keine Rezepte gefunden</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>Lege dein erstes Rezept an!</Typography>
            <Button variant="contained" onClick={() => navigate('/recipes/new')}>Rezept anlegen</Button>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {recipes.length} Rezept{recipes.length !== 1 ? 'e' : ''} gefunden
              </Typography>
              <Button size="small" startIcon={<FileDownloadIcon />} onClick={handleOpenExport}>
                Exportieren
              </Button>
            </Box>
            <Grid container spacing={isMobile ? 1 : 3}>
              {recipes.map(recipe => (
                <Grid key={recipe.id} size={{ xs: 6, sm: 6, md: 4 }}>
                  <RecipeCard
                    recipe={recipe}
                    onView={id => navigate(`/recipes/${id}`)}
                    onEdit={id => navigate(`/recipes/${id}/edit`)}
                    onDelete={handleDelete}
                    compact={isMobile}
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
        sx={{ position: 'fixed', bottom: { xs: 72, sm: 32 }, right: 24 }}
      >
        <AddIcon />
      </Fab>

      {/* Export dialog — pick recipes and generate one combined printable PDF */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rezepte exportieren</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ px: 2, py: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedIds.size === recipes.length && recipes.length > 0}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < recipes.length}
                  onChange={toggleSelectAll}
                />
              }
              label="Alle auswählen"
            />
          </Box>
          <Divider />
          <Stack sx={{ maxHeight: 360, overflowY: 'auto' }}>
            {recipes.map(recipe => (
              <FormControlLabel
                key={recipe.id}
                sx={{ px: 2, py: 0.25 }}
                control={
                  <Checkbox
                    checked={selectedIds.has(recipe.id)}
                    onChange={() => toggleSelected(recipe.id)}
                  />
                }
                label={recipe.name}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Abbrechen</Button>
          <Button
            variant="contained"
            startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
            disabled={exporting || selectedIds.size === 0}
            onClick={handleExport}
          >
            {exporting ? 'Erstelle Dateien…' : 'Erzeuge Dateien'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
