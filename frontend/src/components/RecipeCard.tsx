import {
  Card, CardMedia, CardContent, CardActions,
  Typography, IconButton, Tooltip, Box, Chip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import type { Recipe } from '../types';

interface Props {
  recipe: Recipe;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

export default function RecipeCard({ recipe, onEdit, onDelete, compact = false }: Props) {
  if (compact) {
    return (
      <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {recipe.imageUrl ? (
          <CardMedia component="img" image={recipe.imageUrl} alt={recipe.name}
            sx={{ aspectRatio: '1/1', objectFit: 'cover', width: '100%' }} />
        ) : (
          <Box sx={{ aspectRatio: '1/1', bgcolor: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 32 }}>🍽️</Typography>
          </Box>
        )}
        <CardContent sx={{ p: 1, pb: '4px !important', flexGrow: 1 }}>
          <Typography variant="body2" sx={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 600,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.3,
          }}>
            {recipe.name}
          </Typography>
        </CardContent>
        <CardActions sx={{ justifyContent: 'flex-end', p: 0.5, pt: 0 }}>
          <IconButton size="small" color="primary" onClick={() => onEdit(recipe.id)}>
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => onDelete(recipe.id)}>
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </CardActions>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {recipe.imageUrl ? (
        <CardMedia component="img" image={recipe.imageUrl} alt={recipe.name}
          sx={{ aspectRatio: '4/3', objectFit: 'cover' }} />
      ) : (
        <Box sx={{ aspectRatio: '4/3', bgcolor: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
          <Typography variant="h2" sx={{ fontSize: 48 }}>🍽️</Typography>
          <Typography variant="caption" color="text.secondary">Kein Bild</Typography>
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Typography variant="h6" gutterBottom
          sx={{ fontFamily: '"Playfair Display", serif', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {recipe.name}
        </Typography>
        <Typography variant="body2" color="text.secondary"
          sx={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', mb: 1 }}>
          {recipe.description || 'Keine Beschreibung'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {recipe.ingredients.length} Zutat{recipe.ingredients.length !== 1 ? 'en' : ''} · {recipe.steps.length} Schritt{recipe.steps.length !== 1 ? 'e' : ''}
        </Typography>

        {(recipe.likedBy.length > 0 || recipe.dislikedBy.length > 0) && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
            {recipe.likedBy.map(u => (
              <Chip key={u.id} icon={<ThumbUpIcon />} label={u.name} size="small" color="success" variant="outlined" />
            ))}
            {recipe.dislikedBy.map(u => (
              <Chip key={u.id} icon={<ThumbDownIcon />} label={u.name} size="small" color="error" variant="outlined" />
            ))}
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
        <Tooltip title="Bearbeiten">
          <IconButton size="small" color="primary" onClick={() => onEdit(recipe.id)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Löschen">
          <IconButton size="small" color="error" onClick={() => onDelete(recipe.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}
