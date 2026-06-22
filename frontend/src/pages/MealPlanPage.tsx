import { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Button, Grid, Card, CardMedia, CardContent,
  IconButton, Tooltip, Alert, CircularProgress, Paper, Chip,
  FormControl, InputLabel, Select, MenuItem, TextField,
  List, ListItem, ListItemText, Divider, Stack
} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { generateMealPlan, swapRecipe, getShoppingList, getPersons, getCurrentMealPlan } from '../api/client';
import type { MealPlanEntry, MealPlanConstraint, ShoppingItem, Person } from '../types';

export default function MealPlanPage() {
  const [count, setCount] = useState(4);
  const [constraints, setConstraints] = useState<MealPlanConstraint[]>([]);
  const [plan, setPlan] = useState<MealPlanEntry[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [swappingIdx, setSwappingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load persons and persisted plan on mount
  useEffect(() => {
    Promise.all([
      getPersons().catch(() => [] as Person[]),
      getCurrentMealPlan().catch(() => [] as MealPlanEntry[]),
    ]).then(([p, m]) => {
      setPersons(p);
      if (m.length > 0) setPlan(m);
      setInitialLoading(false);
    });
  }, []);

  // Auto-fetch shopping list whenever plan changes
  useEffect(() => {
    const recipeIds = plan.filter(e => e.recipe).map(e => e.recipe!.id);
    if (!recipeIds.length) {
      setShoppingList([]);
      return;
    }
    getShoppingList(recipeIds)
      .then(list => setShoppingList(list.items))
      .catch(() => {});
  }, [plan]);

  const handleGenerate = async () => {
    setLoading(true); setError(null);
    try {
      const data = await generateMealPlan(count, constraints);
      setPlan(data);
    } catch {
      setError('Wochenplan konnte nicht erstellt werden. Bitte stelle sicher, dass genügend Rezepte vorhanden sind.');
    } finally { setLoading(false); }
  };

  const handleSwap = async (idx: number, recipeIdToSwap: string) => {
    setSwappingIdx(idx); setError(null);
    try {
      const currentIds = plan.filter(e => e.recipe).map(e => e.recipe!.id);
      const replacement = await swapRecipe(currentIds, recipeIdToSwap, idx);
      setPlan(prev => prev.map((e, i) => i === idx ? { ...e, recipe: replacement, noMatch: false } : e));
    } catch {
      setError('Kein alternatives Rezept verfügbar.');
    } finally { setSwappingIdx(null); }
  };

  const addConstraint = () =>
    setConstraints(prev => [...prev, { personId: persons[0]?.id || '', preference: 'liked', count: 1 }]);

  const updateConstraint = (idx: number, field: keyof MealPlanConstraint, value: unknown) =>
    setConstraints(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));

  const removeConstraint = (idx: number) =>
    setConstraints(prev => prev.filter((_, i) => i !== idx));

  const activeRecipes = plan.filter(e => e.recipe);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <Box sx={{ background: 'linear-gradient(135deg, #E8440A 0%, #F5A623 100%)', py: { xs: 4, md: 5 }, px: 2 }}>
        <Container maxWidth="lg">
          <Typography variant="h3" sx={{ color: 'white', mb: 1, textAlign: 'center' }}>Wochenplan</Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', mb: 3, textAlign: 'center' }}>
            Zufällige Mahlzeiten auswählen
          </Typography>

          <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.95)' }}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  type="number"
                  label="Anzahl Mahlzeiten"
                  value={count}
                  onChange={e => setCount(Math.max(1, Math.min(20, Number(e.target.value))))}
                  inputProps={{ min: 1, max: 20 }}
                  sx={{ width: 180 }}
                  size="small"
                />
              </Box>

              {constraints.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Bedingungen</Typography>
                  <Stack spacing={1}>
                    {constraints.map((c, idx) => (
                      <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField
                          type="number"
                          label="Anzahl"
                          value={c.count}
                          onChange={e => updateConstraint(idx, 'count', Math.max(1, Number(e.target.value)))}
                          inputProps={{ min: 1 }}
                          sx={{ width: 90 }}
                          size="small"
                        />
                        <Typography variant="body2">Mahlzeiten,</Typography>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <InputLabel>Vorliebe</InputLabel>
                          <Select value={c.preference} label="Vorliebe"
                            onChange={e => updateConstraint(idx, 'preference', e.target.value)}>
                            <MenuItem value="liked">gemocht von</MenuItem>
                            <MenuItem value="disliked">nicht gemocht von</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <InputLabel>Person</InputLabel>
                          <Select value={c.personId} label="Person"
                            onChange={e => updateConstraint(idx, 'personId', e.target.value)}>
                            {persons.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <IconButton size="small" onClick={() => removeConstraint(idx)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {persons.length > 0 && (
                  <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addConstraint}>
                    Bedingung hinzufügen
                  </Button>
                )}
                <Button variant="contained" size="large"
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AutorenewIcon />}
                  onClick={handleGenerate} disabled={loading}>
                  {loading ? 'Erstelle Plan…' : 'Plan erstellen'}
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

        {initialLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        ) : plan.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography variant="h2" sx={{ fontSize: 72, mb: 2 }}>📅</Typography>
            <Typography variant="h5" color="text.secondary">
              Klicke auf „Plan erstellen", um zu starten
            </Typography>
          </Box>
        ) : (
          <>
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {plan.map((entry, idx) => (
                <Grid key={idx} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  {entry.noMatch || !entry.recipe ? (
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column',
                      bgcolor: 'grey.100', border: '2px dashed', borderColor: 'grey.300' }}>
                      <Box sx={{ aspectRatio: '4/3', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexDirection: 'column', gap: 1, p: 2 }}>
                        <Typography sx={{ fontSize: 36 }}>🚫</Typography>
                        <Chip label="Kein passendes Rezept" size="small" color="warning" />
                        <Tooltip title="Zufälliges Rezept einsetzen">
                          <IconButton size="small" onClick={() => handleSwap(idx, '')}
                            disabled={swappingIdx === idx}
                            sx={{ bgcolor: 'white', boxShadow: 1 }}>
                            {swappingIdx === idx ? <CircularProgress size={18} /> : <SwapHorizIcon color="primary" />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Card>
                  ) : (
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ position: 'relative' }}>
                        <Tooltip title="Austauschen">
                          <Box sx={{ position: 'absolute', top: 6, right: 6, zIndex: 1 }}>
                            <IconButton size="small"
                              onClick={() => handleSwap(idx, entry.recipe!.id)}
                              disabled={swappingIdx === idx}
                              sx={{ bgcolor: 'rgba(255,255,255,0.92)', '&:hover': { bgcolor: 'white' }, boxShadow: 1 }}>
                              {swappingIdx === idx
                                ? <CircularProgress size={18} />
                                : <SwapHorizIcon color="primary" />}
                            </IconButton>
                          </Box>
                        </Tooltip>
                        {entry.recipe.imageUrl ? (
                          <CardMedia component="img" image={entry.recipe.imageUrl} alt={entry.recipe.name}
                            sx={{ aspectRatio: '4/3', objectFit: 'cover' }} />
                        ) : (
                          <Box sx={{ aspectRatio: '4/3', bgcolor: '#FFF3E0', display: 'flex',
                            alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ fontSize: 40 }}>🍽️</Typography>
                          </Box>
                        )}
                      </Box>
                      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                        <Typography variant="subtitle1"
                          sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 600 }}>
                          {entry.recipe.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {entry.recipe.ingredientCount} Zutat{entry.recipe.ingredientCount !== 1 ? 'en' : ''}
                        </Typography>
                      </CardContent>
                    </Card>
                  )}
                </Grid>
              ))}
            </Grid>

            {/* Inline shopping list */}
            {shoppingList.length > 0 && (
              <Paper sx={{ p: 3, borderRadius: 3 }} elevation={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <ShoppingCartIcon color="primary" />
                  <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif' }}>
                    Einkaufsliste
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ({activeRecipes.length} Mahlzeiten)
                  </Typography>
                </Box>
                <Divider sx={{ mb: 1 }} />
                <List dense disablePadding>
                  {shoppingList.map((item, i) => (
                    <ListItem key={i} disablePadding sx={{ py: 0.25 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2">
                            <strong>{item.name}</strong>
                            {(item.quantity || item.unit) && (
                              <Typography component="span" variant="body2" color="text.secondary">
                                {' — '}{[item.quantity, item.unit].filter(Boolean).join(' ')}
                              </Typography>
                            )}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </>
        )}
      </Container>
    </Box>
  );
}

