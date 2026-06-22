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
}

export default function RecipeCard({ recipe, onEdit, onDelete }: Props) {
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
