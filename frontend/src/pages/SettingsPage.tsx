import { useState, useEffect } from 'react';
import {
  Box, Container, Typography, TextField, Button, Paper,
  Alert, CircularProgress, Stack, Tooltip
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { getSettings, saveSettings, getOllamaStatus } from '../api/client';
import type { Settings } from '../types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; downloading: boolean; modelsReady: boolean } | null>(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => setError('Einstellungen konnten nicht geladen werden'));
  }, []);

  useEffect(() => {
    getOllamaStatus()
      .then(setOllamaStatus)
      .catch(() => setOllamaStatus({ available: false, downloading: false, modelsReady: false }));
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(false);
    try {
      await saveSettings(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      // Refresh status after saving since URL/model may have changed
      getOllamaStatus().then(setOllamaStatus).catch(() => {});
    } catch {
      setError('Einstellungen konnden nicht gespeichert werden');
    } finally { setSaving(false); }
  };

  const set = (key: keyof Settings, value: string) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const statusDot = () => {
    if (ollamaStatus === null) return { color: '#9e9e9e', label: 'Status wird geladen…' };
    if (ollamaStatus.downloading) return { color: '#ff9800', label: 'Modelle werden heruntergeladen…' };
    if (ollamaStatus.modelsReady) return { color: '#4caf50', label: 'Ollama erreichbar und bereit' };
    if (ollamaStatus.available) return { color: '#ff9800', label: 'Ollama erreichbar, Modelle werden vorbereitet…' };
    return { color: '#f44336', label: 'Ollama nicht erreichbar' };
  };

  const { color, label } = statusDot();

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100vh - 64px)' }}>
      <Box sx={{ background: 'linear-gradient(135deg, #E8440A 0%, #F5A623 100%)', py: 4, px: 2, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ color: 'white', mb: 1 }}>Einstellungen</Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)' }}>
          KI-Einstellungen
        </Typography>
      </Box>

      <Container maxWidth="sm" sx={{ py: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 3 }}>Einstellungen gespeichert ✓</Alert>}

        {/* Ollama */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif' }}>
              🤖 KI (Ollama)
            </Typography>
            <Tooltip title={label}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'default' }}>
                <Box sx={{
                  width: 12, height: 12, borderRadius: '50%',
                  bgcolor: color,
                  boxShadow: `0 0 6px ${color}`,
                }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
              </Box>
            </Tooltip>
          </Box>
          <Stack spacing={2}>
            <TextField
              label="Ollama URL"
              fullWidth
              value={settings.ollama_url || ''}
              onChange={e => set('ollama_url', e.target.value)}
              placeholder="http://Stefans-PC:11434"
              helperText="URL deines Ollama-Servers (Desktop-PC)"
            />
            <TextField
              label="Vision-Modell (für Foto-Parse)"
              fullWidth
              value={settings.ollama_vision_model || ''}
              onChange={e => set('ollama_vision_model', e.target.value)}
              placeholder="llava:7b"
            />
            <TextField
              label="Text-Modell (für Diktat)"
              fullWidth
              value={settings.ollama_text_model || ''}
              onChange={e => set('ollama_text_model', e.target.value)}
              placeholder="llama3.2:3b"
            />
          </Stack>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Speichern…' : 'Einstellungen speichern'}
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
