import { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, Grid, Button, CircularProgress, Alert, Fab,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControlLabel, Checkbox, TextField, Stack,
  useMediaQuery, useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import type { Recipe } from '../types';
import { getRecipes, deleteRecipe, createComposedRecipe } from '../api/client';
import RecipeCard from '../components/RecipeCard';
import RecipeSectionTabs from '../components/RecipeSectionTabs';

export default function ComposedRecipesPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [composedRecipes, setComposedRecipes] = useState<Recipe[]>([]);
  const [componentOptions, setComponentOptions] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [composed, options] = await Promise.all([
        getRecipes(undefined, undefined, { composed: true }),
        getRecipes(undefined, undefined, { category: 'other' }),
      ]);
      setComposedRecipes(composed);
      setComponentOptions(options);
    } catch {
      setError('Rezepte konnten nicht geladen werden. Läuft der Server?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Zusammengesetztes Rezept wirklich löschen?')) return;
    try {
      await deleteRecipe(id);
      setComposedRecipes(prev => prev.filter(r => r.id !== id));
    } catch {
      setError('Rezept konnte nicht gelöscht werden.');
    }
  };

  const handleOpenCreate = () => {
    setNewName('');
    setSelectedIds(new Set());
    setFormError(null);
    setCreateDialogOpen(true);
  };

  const toggleComponent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      setFormError('Bitte einen Namen angeben.');
      return;
    }
    if (selectedIds.size < 2) {
      setFormError('Bitte mindestens zwei Rezepte auswählen.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await createComposedRecipe(newName.trim(), Array.from(selectedIds));
      setComposedRecipes(prev => [created, ...prev]);
      setCreateDialogOpen(false);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(message || 'Zusammengesetztes Rezept konnte nicht erstellt werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100vh - 64px)' }}>
      <RecipeSectionTabs />

      <Box sx={{ background: 'linear-gradient(135deg, #E8440A 0%, #F5A623 100%)', py: { xs: 2, md: 5 }, px: 2, textAlign: 'center' }}>
        <Typography variant={isMobile ? 'h5' : 'h3'} sx={{ color: 'white', mb: 1 }}>Zusammengesetzte Rezepte</Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)' }}>
          Kombiniere z.B. "Kartoffelpüree" und "Schnitzel" zu einem Hauptgericht
        </Typography>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, sm: 3 } }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : composedRecipes.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h2" sx={{ fontSize: 64, mb: 2 }}>🍽️</Typography>
            <Typography variant="h5" color="text.secondary" sx={{ mb: 1 }}>Noch keine zusammengesetzten Rezepte</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Kombiniere Beilagen zu einem vollständigen Hauptgericht!
            </Typography>
            <Button variant="contained" onClick={handleOpenCreate} disabled={componentOptions.length < 2}>
              Zusammengesetztes Rezept erstellen
            </Button>
            {componentOptions.length < 2 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Lege mindestens zwei "Sonstiges"-Rezepte an, um sie kombinieren zu können.
              </Typography>
            )}
          </Box>
        ) : (
          <Grid container spacing={isMobile ? 1 : 3}>
            {composedRecipes.map(recipe => (
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
        )}
      </Container>

      <Fab
        color="primary"
        aria-label="Zusammengesetztes Rezept hinzufügen"
        onClick={handleOpenCreate}
        disabled={componentOptions.length < 2}
        sx={{ position: 'fixed', bottom: { xs: 72, sm: 32 }, right: 24 }}
      >
        <AddIcon />
      </Fab>

      {/* Create dialog — combine several "Sonstiges" recipes into one main-dish recipe */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Zusammengesetztes Rezept erstellen</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ p: 2 }}>
            <TextField
              label="Name *"
              fullWidth
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="z.B. Schnitzel mit Kartoffelpüree"
            />
          </Box>
          <Box sx={{ px: 2, pb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Rezepte auswählen ({selectedIds.size} ausgewählt)
            </Typography>
          </Box>
          <Stack sx={{ maxHeight: 300, overflowY: 'auto' }}>
            {componentOptions.map(recipe => (
              <FormControlLabel
                key={recipe.id}
                sx={{ px: 2, py: 0.25 }}
                control={
                  <Checkbox
                    checked={selectedIds.has(recipe.id)}
                    onChange={() => toggleComponent(recipe.id)}
                  />
                }
                label={recipe.name}
              />
            ))}
          </Stack>
          {formError && <Alert severity="error" sx={{ m: 2 }}>{formError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Abbrechen</Button>
          <Button
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={handleCreate}
          >
            {saving ? 'Speichere…' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
