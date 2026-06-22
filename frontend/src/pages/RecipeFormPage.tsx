import { useState, useEffect, useRef } from 'react';
import {
  Box, Container, Typography, TextField, Button, IconButton,
  Alert, CircularProgress, Paper, Divider, Chip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, Stack, Autocomplete
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MicIcon from '@mui/icons-material/Mic';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import MicOffIcon from '@mui/icons-material/MicOff';
import StopIcon from '@mui/icons-material/Stop';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useNavigate, useParams } from 'react-router-dom';
import type { RecipeIngredient, RecipeStep, Person, ParsedRecipe } from '../types';
import {
  getRecipe, createRecipe, updateRecipe, uploadImage,
  parseRecipeFromImage, parseRecipeFromText,
  getOllamaStatus, getPersons, createPerson, getCanonicalUnits, getUsedUnits,
} from '../api/client';

interface IngredientRow extends RecipeIngredient { _key: string }
interface StepRow extends RecipeStep { _key: string }

let _keyCounter = 0;
const nextKey = () => String(++_keyCounter);

export default function RecipeFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const parseImageInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { _key: nextKey(), name: '', quantity: '', unit: '' }
  ]);
  const [steps, setSteps] = useState<StepRow[]>([{ _key: nextKey(), instruction: '' }]);
  const [likedBy, setLikedBy] = useState<string[]>([]);
  const [dislikedBy, setDislikedBy] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; downloading: boolean; modelsReady: boolean } | null>(null);
  const [dictationText, setDictationText] = useState('');
  const [dictationDialogOpen, setDictationDialogOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTextRef = useRef('');  // accumulates confirmed words across restarts
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [canonicalUnits, setCanonicalUnits] = useState<Record<string, string>>({});
  const [usedUnits, setUsedUnits] = useState<string[]>([]);

  useEffect(() => {
    getPersons().then(setPersons).catch(() => {});
    getCanonicalUnits().then(setCanonicalUnits).catch(() => {});
    getUsedUnits().then(setUsedUnits).catch(() => {});

    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchStatus = () => {
      getOllamaStatus()
        .then(s => {
          setOllamaStatus(s);
          // Stop polling once download is done (or never started)
          if (!s.downloading && interval !== null) {
            clearInterval(interval);
            interval = null;
          }
        })
        .catch(() => setOllamaStatus({ available: false, downloading: false, modelsReady: false }));
    };

    fetchStatus();
    // Poll every 5 s to catch when download completes
    interval = setInterval(fetchStatus, 5000);

    return () => { if (interval !== null) clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!id) return;
    getRecipe(id).then(recipe => {
      setName(recipe.name);
      setDescription(recipe.description);
      setIngredients(
        recipe.ingredients.length
          ? recipe.ingredients.map(i => ({ ...i, _key: nextKey() }))
          : [{ _key: nextKey(), name: '', quantity: '', unit: '' }]
      );
      setSteps(
        recipe.steps.length
          ? recipe.steps.map(s => ({ ...s, _key: nextKey() }))
          : [{ _key: nextKey(), instruction: '' }]
      );
      setLikedBy(recipe.likedBy.map(p => p.id));
      setDislikedBy(recipe.dislikedBy.map(p => p.id));
      setExistingImageUrl(recipe.imageUrl);
    }).catch(() => setError('Rezept konnte nicht geladen werden.'));
  }, [id]);

  const applyParsed = (parsed: ParsedRecipe) => {
    if (parsed.name) setName(parsed.name);
    if (parsed.description) setDescription(parsed.description);
    if (parsed.ingredients?.length)
      setIngredients(parsed.ingredients.map(i => ({ ...i, _key: nextKey() })));
    if (parsed.steps?.length)
      setSteps(parsed.steps.map(s => ({
        _key: nextKey(),
        instruction: typeof s === 'string' ? s : (s as RecipeStep).instruction
      })));
  };

  const SpeechRecognitionAPI =
    (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition })
      .SpeechRecognition ||
    (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
  const speechSupported = Boolean(SpeechRecognitionAPI);

  const startRecording = () => {
    if (!SpeechRecognitionAPI) return;
    finalTextRef.current = dictationText;

    const rec = new SpeechRecognitionAPI();
    rec.lang = 'de-DE';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      let newFinal = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) newFinal += t + ' ';
        else interim += t;
      }
      if (newFinal) {
        finalTextRef.current = (finalTextRef.current + newFinal).trimStart();
        setDictationText(finalTextRef.current);
      }
      setInterimText(interim);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'aborted') setError(`Mikrofon-Fehler: ${e.error}`);
      setIsRecording(false);
      setInterimText('');
    };

    rec.onend = () => {
      // Restart automatically while still recording (Chrome stops after silence)
      if (recognitionRef.current === rec && isRecording) {
        try { rec.start(); } catch { /* ignore if already stopped */ }
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
    setInterimText('');
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
    setInterimText('');
  };

  const closeDictationDialog = () => {
    stopRecording();
    setDictationDialogOpen(false);
    setDictationText('');
    finalTextRef.current = '';
    setInterimText('');
  };

  const handleParseImage = async (file: File) => {
    setParsing(true); setError(null);
    try {
      applyParsed(await parseRecipeFromImage(file));
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Fehler beim Analysieren des Bildes');
    } finally { setParsing(false); }
  };

  const handleParseDictation = async () => {
    stopRecording();
    const text = dictationText.trim();
    if (!text) return;
    setParsing(true); setError(null);
    try {
      applyParsed(await parseRecipeFromText(text));
      setDictationDialogOpen(false);
      setDictationText('');
      finalTextRef.current = '';
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Fehler beim Verarbeiten des Textes');
    } finally { setParsing(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Name ist erforderlich'); return; }
    setSaving(true); setError(null);
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        ingredients: ingredients.filter(i => i.name.trim()),
        steps: steps.filter(s => s.instruction.trim()).map(s => s.instruction),
        likedBy, dislikedBy,
      };
      const saved = isEdit && id ? await updateRecipe(id, body) : await createRecipe(body);
      if (imageFile) await uploadImage(saved.id, imageFile);
      setSuccess(true);
      setTimeout(() => navigate('/recipes'), 800);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Fehler beim Speichern');
    } finally { setSaving(false); }
  };

  const handleAddPerson = async () => {
    if (!newPersonName.trim()) return;
    try {
      const p = await createPerson(newPersonName.trim());
      setPersons(prev => [...prev, p]);
      setNewPersonName('');
      setPersonDialogOpen(false);
    } catch { setError('Person konnte nicht erstellt werden'); }
  };

  const togglePref = (personId: string, pref: 'liked' | 'disliked') => {
    if (pref === 'liked') {
      setLikedBy(prev => prev.includes(personId) ? prev.filter(i => i !== personId) : [...prev, personId]);
      setDislikedBy(prev => prev.filter(i => i !== personId));
    } else {
      setDislikedBy(prev => prev.includes(personId) ? prev.filter(i => i !== personId) : [...prev, personId]);
      setLikedBy(prev => prev.filter(i => i !== personId));
    }
  };

  const updateIngredient = (key: string, field: keyof RecipeIngredient, val: string) =>
    setIngredients(prev => prev.map(ing => {
      if (ing._key !== key) return ing;
      const updated = { ...ing, [field]: val };
      // Auto-fill unit from canonical map when name is typed and unit is still empty
      if (field === 'name' && !ing.unit) {
        const canonical = canonicalUnits[val.toLowerCase().trim()];
        if (canonical) updated.unit = canonical;
      }
      return updated;
    }));
  const addIngredient = () =>
    setIngredients(prev => [...prev, { _key: nextKey(), name: '', quantity: '', unit: '' }]);
  const removeIngredient = (key: string) =>
    setIngredients(prev => prev.length > 1 ? prev.filter(i => i._key !== key) : prev);

  const updateStep = (key: string, val: string) =>
    setSteps(prev => prev.map(s => s._key === key ? { ...s, instruction: val } : s));
  const addStep = () => setSteps(prev => [...prev, { _key: nextKey(), instruction: '' }]);
  const removeStep = (key: string) =>
    setSteps(prev => prev.length > 1 ? prev.filter(s => s._key !== key) : prev);

  const UNITS = usedUnits;

  /** Accepts: integers, decimals (. or ,), fractions (3/4). Rejects everything else. */
  const isValidQuantity = (val: string) => val === '' || /^[\d.,/]+$/.test(val);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <Box sx={{ background: 'linear-gradient(135deg, #E8440A 0%, #F5A623 100%)', py: 4, px: 2 }}>
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/recipes')} sx={{ color: 'white' }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" sx={{ color: 'white', fontFamily: '"Playfair Display", serif' }}>
              {isEdit ? 'Rezept bearbeiten' : 'Neues Rezept'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {ollamaStatus?.downloading ? (
              <>
                <Tooltip title="Nicht verfügbar, nötige Systeme werden installiert">
                  <span>
                    <Button variant="outlined" startIcon={<CircularProgress size={16} color="inherit" />}
                      disabled
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.15)', color: 'white', borderColor: 'rgba(255,255,255,0.5)',
                        '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', borderColor: 'rgba(255,255,255,0.15)' },
                      }}>
                      Rezept diktieren
                    </Button>
                  </span>
                </Tooltip>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', alignSelf: 'center' }}>
                  ⏳ Nicht verfügbar, nötige Systeme werden installiert
                </Typography>
              </>
            ) : (
              <>
                <Tooltip title={!ollamaStatus?.available ? 'Das Feature ist nur verfügbar, wenn der PC eingeschaltet ist' : ''}>
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={<MicIcon />}
                      disabled={!ollamaStatus?.modelsReady || parsing}
                      onClick={() => setDictationDialogOpen(true)}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.15)', color: 'white', borderColor: 'rgba(255,255,255,0.5)',
                        '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', borderColor: 'rgba(255,255,255,0.15)' },
                      }}
                    >
                      Rezept diktieren
                    </Button>
                  </span>
                </Tooltip>
                {ollamaStatus?.available === false && (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', alignSelf: 'center' }}>
                    ⚠️ Das Feature ist nur verfügbar, wenn der PC eingeschaltet ist
                  </Typography>
                )}
              </>
            )}
          </Box>
          <input ref={parseImageInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleParseImage(e.target.files[0])} />
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 3 }}>Rezept gespeichert! ✓</Alert>}

        {/* Basics */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontFamily: '"Playfair Display", serif' }}>Grunddaten</Typography>
          <Stack spacing={2}>
            <TextField label="Rezeptname *" fullWidth value={name} onChange={e => setName(e.target.value)} />
            <TextField label="Kurzbeschreibung" fullWidth multiline rows={2} value={description}
              onChange={e => setDescription(e.target.value)} placeholder="Ein kurzer Satz über das Rezept…" />
          </Stack>
        </Paper>

        {/* Image */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontFamily: '"Playfair Display", serif' }}>Bild</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {(imagePreview || existingImageUrl) && (
              <Box component="img" src={imagePreview || existingImageUrl || ''}
                sx={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 2 }} />
            )}
            <Box>
              <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => imageInputRef.current?.click()}>
                Bild hochladen
              </Button>
              <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
                }} />
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                JPG, PNG oder WebP, max. 20 MB
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Ingredients */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontFamily: '"Playfair Display", serif' }}>Zutaten</Typography>
          <Stack spacing={1.5}>
            {ingredients.map((ing) => {
              const canonical = canonicalUnits[ing.name.toLowerCase().trim()];
              const unitMismatch = canonical && ing.unit && ing.unit.toLowerCase() !== canonical.toLowerCase();
              return (
                <Box key={ing._key} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <DragIndicatorIcon sx={{ color: 'text.disabled', flexShrink: 0 }} />
                  <TextField label="Menge" value={ing.quantity}
                    onChange={e => {
                      if (isValidQuantity(e.target.value))
                        updateIngredient(ing._key, 'quantity', e.target.value);
                    }}
                    inputProps={{ inputMode: 'decimal' }}
                    sx={{ width: 90 }} size="small" />
                  <Tooltip title={unitMismatch ? `Andere Rezepte verwenden „${canonical}" für diese Zutat → Einkaufsliste kann nicht zusammengefasst werden` : ''}>
                    <Autocomplete freeSolo options={UNITS} value={ing.unit}
                      onInputChange={(_, val) => updateIngredient(ing._key, 'unit', val)}
                      renderInput={params => (
                        <TextField {...params} label="Einheit" size="small"
                          color={unitMismatch ? 'warning' : undefined}
                          focused={unitMismatch || undefined}
                        />
                      )}
                      sx={{ width: 110 }} />
                  </Tooltip>
                  <TextField label="Zutat *" value={ing.name}
                    onChange={e => updateIngredient(ing._key, 'name', e.target.value)}
                    size="small" sx={{ flexGrow: 1 }} />
                  <IconButton size="small" onClick={() => removeIngredient(ing._key)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </Box>
              );
            })}
          </Stack>
          <Button startIcon={<AddIcon />} onClick={addIngredient} sx={{ mt: 1.5 }}>
            Zutat hinzufügen
          </Button>
        </Paper>

        {/* Steps */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontFamily: '"Playfair Display", serif' }}>Zubereitung</Typography>
          <Stack spacing={2}>
            {steps.map((step, idx) => (
              <Box key={step._key} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 28, height: 28, fontSize: 13, flexShrink: 0, mt: 1 }}>
                  {idx + 1}
                </Avatar>
                <TextField multiline minRows={2} fullWidth placeholder={`Schritt ${idx + 1}…`}
                  value={step.instruction} onChange={e => updateStep(step._key, e.target.value)} size="small" />
                <IconButton size="small" onClick={() => removeStep(step._key)} color="error" sx={{ mt: 0.5 }}>
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
          </Stack>
          <Button startIcon={<AddIcon />} onClick={addStep} sx={{ mt: 1.5 }}>
            Schritt hinzufügen
          </Button>
        </Paper>

        {/* Persons */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif' }}>Vorlieben im Haushalt</Typography>
            <Button startIcon={<PersonAddIcon />} size="small" onClick={() => setPersonDialogOpen(true)}>
              Person anlegen
            </Button>
          </Box>
          {persons.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Noch keine Personen angelegt. Klicke auf „Person anlegen".
            </Typography>
          ) : (
            <Stack spacing={1}>
              {persons.map(person => {
                const liked = likedBy.includes(person.id);
                const disliked = dislikedBy.includes(person.id);
                return (
                  <Box key={person.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ flexGrow: 1 }}>{person.name}</Typography>
                    <Chip icon={<ThumbUpIcon />} label="Mag es" size="small"
                      color={liked ? 'success' : 'default'} variant={liked ? 'filled' : 'outlined'}
                      onClick={() => togglePref(person.id, 'liked')} />
                    <Chip icon={<ThumbDownIcon />} label="Mag es nicht" size="small"
                      color={disliked ? 'error' : 'default'} variant={disliked ? 'filled' : 'outlined'}
                      onClick={() => togglePref(person.id, 'disliked')} />
                  </Box>
                );
              })}
            </Stack>
          )}
        </Paper>

        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={() => navigate('/recipes')}>Abbrechen</Button>
          <Button variant="contained" size="large"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSave} disabled={saving}>
            {saving ? 'Speichern…' : 'Rezept speichern'}
          </Button>
        </Box>
      </Container>

      {/* Person anlegen Dialog */}
      <Dialog open={personDialogOpen} onClose={() => setPersonDialogOpen(false)}>
        <DialogTitle>Person anlegen</DialogTitle>
        <DialogContent>
          <TextField autoFocus label="Name" fullWidth value={newPersonName}
            onChange={e => setNewPersonName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddPerson()} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPersonDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={handleAddPerson}>Anlegen</Button>
        </DialogActions>
      </Dialog>

      {/* Diktat Dialog */}
      <Dialog open={dictationDialogOpen} onClose={closeDictationDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Rezept diktieren</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Drücke auf das Mikrofon und erkläre das Rezept auf Deutsch — die KI strukturiert es für dich.
          </Typography>

          {/* Mic button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            {!speechSupported ? (
              <Typography variant="body2" color="error">
                Spracherkennung wird in diesem Browser nicht unterstützt (Chrome/Edge empfohlen).
              </Typography>
            ) : isRecording ? (
              <Tooltip title="Aufnahme stoppen">
                <IconButton
                  onClick={stopRecording}
                  sx={{
                    width: 72, height: 72, bgcolor: 'error.main', color: 'white',
                    animation: 'pulse 1.2s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%': { boxShadow: '0 0 0 0 rgba(211,47,47,0.5)' },
                      '70%': { boxShadow: '0 0 0 14px rgba(211,47,47,0)' },
                      '100%': { boxShadow: '0 0 0 0 rgba(211,47,47,0)' },
                    },
                    '&:hover': { bgcolor: 'error.dark' },
                  }}
                >
                  <StopIcon sx={{ fontSize: 36 }} />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Aufnahme starten">
                <IconButton
                  onClick={startRecording}
                  sx={{
                    width: 72, height: 72, bgcolor: 'primary.main', color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                >
                  <MicIcon sx={{ fontSize: 36 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Status */}
          {isRecording && (
            <Typography variant="caption" color="error" sx={{ display: 'block', textAlign: 'center', mb: 1 }}>
              🔴 Aufnahme läuft… sprich jetzt
            </Typography>
          )}

          {/* Transcript */}
          <Box sx={{ position: 'relative' }}>
            <TextField
              multiline
              rows={5}
              fullWidth
              placeholder="Hier erscheint dein diktierter Text…"
              value={dictationText + (interimText ? interimText : '')}
              onChange={e => {
                setDictationText(e.target.value);
                finalTextRef.current = e.target.value;
              }}
              slotProps={{ input: { readOnly: isRecording } }}
              sx={{ '& textarea': { color: interimText ? 'text.secondary' : 'text.primary' } }}
            />
            {dictationText && (
              <Tooltip title="Text löschen">
                <IconButton
                  size="small"
                  onClick={() => { setDictationText(''); finalTextRef.current = ''; setInterimText(''); }}
                  sx={{ position: 'absolute', top: 6, right: 6 }}
                >
                  <DeleteSweepIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {!speechSupported && (
            <TextField
              autoFocus
              multiline
              rows={5}
              fullWidth
              placeholder="Text hier eingeben…"
              value={dictationText}
              onChange={e => setDictationText(e.target.value)}
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDictationDialog} startIcon={<MicOffIcon />}>Abbrechen</Button>
          <Button variant="contained" onClick={handleParseDictation}
            disabled={parsing || !dictationText.trim()}
            startIcon={parsing ? <CircularProgress size={16} color="inherit" /> : <MicIcon />}>
            {parsing ? 'Verarbeite…' : 'Rezept erstellen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
