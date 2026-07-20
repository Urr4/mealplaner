import { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, IconButton, Chip, Paper, Stack, Avatar,
  CircularProgress, Alert, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControlLabel, Checkbox,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import { useNavigate, useParams } from 'react-router-dom';
import type { Recipe } from '../types';
import { getRecipe } from '../api/client';
import { buildRecipePdf } from '../utils/recipePdf';

export default function RecipeViewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [includeImage, setIncludeImage] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getRecipe(id)
      .then(setRecipe)
      .catch(() => setError('Rezept konnte nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrintClick = () => {
    if (!recipe) return;
    // Skip the choice dialog when there's no image to choose about.
    if (!recipe.imageUrl) {
      handleGeneratePdf(false);
      return;
    }
    setIncludeImage(true);
    setPrintDialogOpen(true);
  };

  const handleGeneratePdf = useCallback(async (withImage: boolean) => {
    if (!recipe) return;
    setPrintDialogOpen(false);
    setPrinting(true);
    try {
      const url = await buildRecipePdf(recipe, { includeImage: withImage });
      window.open(url, '_blank');
    } catch {
      setError('PDF konnte nicht erstellt werden.');
    } finally {
      setPrinting(false);
    }
  }, [recipe]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error || !recipe) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Rezept nicht gefunden.'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/recipes')}>Zurück zur Übersicht</Button>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100vh - 64px)' }}>
      {/* Header / image */}
      <Box sx={{ position: 'relative' }}>
        {recipe.imageUrl ? (
          <Box component="img" src={recipe.imageUrl} alt={recipe.name}
            sx={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
        ) : (
          <Box sx={{
            width: '100%', height: 180, bgcolor: '#FFF3E0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ fontSize: 56 }}>🍽️</Typography>
          </Box>
        )}
        <IconButton onClick={() => navigate('/recipes')}
          sx={{
            position: 'absolute', top: 8, left: 8,
            bgcolor: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'white' },
          }}>
          <ArrowBackIcon />
        </IconButton>
        <IconButton onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
          sx={{
            position: 'absolute', top: 8, right: 8,
            bgcolor: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'white' },
          }}>
          <EditIcon />
        </IconButton>
      </Box>

      <Container maxWidth="sm" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3 } }}>
        <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', mb: 0.5, fontSize: { xs: 26, sm: 34 } }}>
          {recipe.name}
        </Typography>
        {recipe.description && (
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {recipe.description}
          </Typography>
        )}

        {(recipe.likedBy.length > 0 || recipe.dislikedBy.length > 0) && (
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
            {recipe.likedBy.map(u => (
              <Chip key={u.id} icon={<ThumbUpIcon />} label={u.name} size="small" color="success" variant="outlined" />
            ))}
            {recipe.dislikedBy.map(u => (
              <Chip key={u.id} icon={<ThumbDownIcon />} label={u.name} size="small" color="error" variant="outlined" />
            ))}
          </Box>
        )}

        <Button
          fullWidth
          variant="contained"
          startIcon={printing ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
          onClick={handlePrintClick}
          disabled={printing}
          sx={{ mb: 3 }}
        >
          {printing ? 'Erstelle PDF…' : 'Drucken'}
        </Button>

        {/* Ingredients */}
        <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 1.5, fontFamily: '"Playfair Display", serif' }}>Zutaten</Typography>
          <Stack spacing={1}>
            {recipe.ingredients.map((ing, idx) => (
              <Box key={ing.id ?? idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
                <Typography variant="body2" sx={{ minWidth: 64, fontWeight: 600, color: 'primary.main' }}>
                  {[ing.quantity, ing.unit].filter(Boolean).join(' ')}
                </Typography>
                <Typography variant="body1">{ing.name}</Typography>
              </Box>
            ))}
          </Stack>
        </Paper>

        {/* Steps */}
        <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 1.5, fontFamily: '"Playfair Display", serif' }}>Zubereitung</Typography>
          <Stack spacing={2}>
            {recipe.steps.map((step, idx) => (
              <Box key={step.id ?? idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 26, height: 26, fontSize: 13, flexShrink: 0 }}>
                  {idx + 1}
                </Avatar>
                <Typography variant="body1" sx={{ pt: 0.2 }}>{step.instruction}</Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      </Container>

      {/* Print options dialog */}
      <Dialog open={printDialogOpen} onClose={() => setPrintDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rezeptkarte drucken</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Soll das Bild in der PDF-Rezeptkarte enthalten sein?
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeImage}
                onChange={e => setIncludeImage(e.target.checked)}
              />
            }
            label="Bild einschließen"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintDialogOpen(false)}>Abbrechen</Button>
          <Button
            variant="contained"
            startIcon={printing ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
            disabled={printing}
            onClick={() => handleGeneratePdf(includeImage)}
          >
            {printing ? 'Erstelle PDF…' : 'PDF erstellen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
