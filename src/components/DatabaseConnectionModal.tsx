import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';

interface DatabaseConnectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
  initialValues?: any;
}

const DatabaseConnectionModal: React.FC<DatabaseConnectionModalProps> = ({
  visible,
  onClose,
  onSave,
  initialValues,
}) => {
  const [formData, setFormData] = React.useState({
    type: 'mysql',
    host: '',
    port: '',
    database: '',
    username: '',
    password: '',
  });

  // Initialize form data with initialValues if provided
  React.useEffect(() => {
    if (initialValues) {
      setFormData({
        type: initialValues.type || 'mysql',
        host: initialValues.host || '',
        port: initialValues.port || '',
        database: initialValues.database || '',
        username: initialValues.username || '',
        password: initialValues.password || '',
      });
    }
  }, [initialValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={visible} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Connect Database</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Database Type</InputLabel>
            <Select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <MenuItem value="mysql">MySQL</MenuItem>
              <MenuItem value="postgresql">PostgreSQL</MenuItem>
              <MenuItem value="mssql">SQL Server</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            margin="normal"
            label="Host"
            value={formData.host}
            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Port"
            value={formData.port}
            onChange={(e) => setFormData({ ...formData, port: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Database"
            value={formData.database}
            onChange={(e) => setFormData({ ...formData, database: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary">
            Connect
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default DatabaseConnectionModal;