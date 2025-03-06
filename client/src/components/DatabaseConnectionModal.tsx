import React, { useState, useEffect } from 'react';
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
  FormHelperText,
  CircularProgress,
  Snackbar,
  Alert,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { DatabaseType, DataSource } from '../types/database';

interface DatabaseConnectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (config: any) => Promise<void>;
  initialValues?: DataSource | null;
}

const DatabaseConnectionModal: React.FC<DatabaseConnectionModalProps> = ({
  visible,
  onClose,
  onSave,
  initialValues
}) => {
  console.log('Modal visible:', visible); // Add this for debugging
  
  const [loading, setLoading] = useState(false);
  const [formValues, setFormValues] = useState({
    name: '',
    type: 'mysql' as DatabaseType, // Set default value to mysql instead of empty string
    host: '',
    port: '3306', // Default MySQL port
    database: '',
    username: '',
    password: '',
    connectString: '',
    encrypt: false,
    serviceName: '',
  });
  
  // Add useEffect to handle initialValues
  useEffect(() => {
    if (initialValues) {
      setFormValues({
        name: initialValues.name || '',
        type: initialValues.connectionConfig.databaseType as DatabaseType || 'mysql', // Add default
        host: initialValues.connectionConfig.host || '',
        port: initialValues.connectionConfig.port?.toString() || getDefaultPort(initialValues.connectionConfig.databaseType as DatabaseType),
        database: initialValues.connectionConfig.database || '',
        username: initialValues.connectionConfig.username || '',
        password: initialValues.connectionConfig.password || '',
        connectString: initialValues.connectionConfig.connectString || '',
        encrypt: initialValues.connectionConfig.encrypt || false,
        serviceName: initialValues.connectionConfig.serviceName || '',
      });
    } else {
      // Reset form when not editing
      setFormValues({
        name: '',
        type: 'mysql' as DatabaseType, // Set default value to mysql
        host: '',
        port: '3306', // Default MySQL port
        database: '',
        username: '',
        password: '',
        connectString: '',
        encrypt: false,
        serviceName: '',
      });
    }
  }, [initialValues, visible]);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const databaseTypes: { label: string; value: DatabaseType }[] = [
    { label: 'MySQL', value: 'mysql' },
    { label: 'PostgreSQL', value: 'postgres' },
    { label: 'Oracle', value: 'oracle' },
    { label: 'Microsoft SQL Server', value: 'mssql' },
    { label: 'SQLite', value: 'sqlite' },
  ];

  // Function to get default port based on database type
  const getDefaultPort = (dbType: DatabaseType): string => {
    switch (dbType) {
      case 'mysql':
        return '3306';
      case 'postgres':
        return '5432';
      case 'mssql':
        return '1433';
      case 'oracle':
        return '1521';
      default:
        return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    
    // Special handling for database type change
    if (name === 'type') {
      const dbType = value as DatabaseType;
      setFormValues({
        ...formValues,
        type: dbType,
        port: getDefaultPort(dbType),
      });
    } else {
      setFormValues({
        ...formValues,
        [name as string]: value,
      });
    }
    
    // Clear error when field is edited
    if (errors[name as string]) {
      setErrors({
        ...errors,
        [name as string]: '',
      });
    }
  };
  
  // Handle switch change for boolean values
  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormValues({
      ...formValues,
      [name]: checked,
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let requiredFields: string[] = ['name', 'type'];
    
    // Add required fields based on database type
    switch (formValues.type) {
      case 'mysql':
      case 'postgres':
        requiredFields = [...requiredFields, 'host', 'port', 'database', 'username', 'password'];
        break;
      case 'mssql':
        requiredFields = [...requiredFields, 'host', 'port', 'database', 'username', 'password'];
        break;
      case 'oracle':
        requiredFields = [...requiredFields, 'connectString', 'username', 'password', 'serviceName'];
        break;
      case 'sqlite':
        requiredFields = [...requiredFields, 'database'];
        break;
    }
    
    requiredFields.forEach(field => {
      if (!formValues[field as keyof typeof formValues]) {
        newErrors[field] = 'This field is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      await onSave({
        ...formValues,
        port: parseInt(formValues.port),
      });
      setFormValues({
        name: '',
        type: 'mysql' as DatabaseType,
        host: '',
        port: '3306',
        database: '',
        username: '',
        password: '',
        connectString: '',
        encrypt: false,
        serviceName: '',
      });
      onClose();
      setSnackbar({
        open: true,
        message: 'Database connection saved successfully',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save database connection',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false,
    });
  };

  return (
    <>
      <Dialog 
        open={visible} 
        onClose={onClose} 
        maxWidth="sm" 
        fullWidth
        sx={{ zIndex: 9999 }}
        TransitionProps={{
          onEnter: () => console.log('Dialog entering...'),
          onExited: () => console.log('Dialog exited...')
        }}
      >
        <DialogTitle>Connect to Database</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            name="name"
            label="Connection Name"
            fullWidth
            value={formValues.name}
            onChange={handleChange}
            error={!!errors.name}
            helperText={errors.name}
            required
          />

          <FormControl 
            fullWidth 
            margin="dense" 
            error={!!errors.type}
            required
            variant="outlined"
          >
            <InputLabel id="database-type-label">Database Type</InputLabel>
            <Select
              labelId="database-type-label"
              name="type"
              value={formValues.type}
              onChange={(e) => {
                handleChange({
                  target: {
                    name: 'type',
                    value: e.target.value
                  }
                } as React.ChangeEvent<HTMLInputElement>)
              }}
              label="Database Type"
              MenuProps={{
                disablePortal: true,
                anchorOrigin: {
                  vertical: 'bottom',
                  horizontal: 'left',
                },
                transformOrigin: {
                  vertical: 'top',
                  horizontal: 'left',
                },
                PaperProps: {
                  style: { maxHeight: 300 }
                }
              }}
            >
              {databaseTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
            {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
          </FormControl>

          {/* Dynamic form fields based on database type */}
          {(formValues.type === 'mysql' || formValues.type === 'postgres' || formValues.type === 'mssql') && (
            <>
              <TextField
                margin="dense"
                name="host"
                label={formValues.type === 'mssql' ? "Server" : "Host"}
                fullWidth
                value={formValues.host}
                onChange={handleChange}
                error={!!errors.host}
                helperText={errors.host || (formValues.type === 'mysql' || formValues.type === 'postgres' ? "Server hostname/IP address" : "")}
                required
              />

              <TextField
                margin="dense"
                name="port"
                label="Port"
                fullWidth
                type="number"
                inputProps={{ min: 1, max: 65535 }}
                value={formValues.port}
                onChange={handleChange}
                error={!!errors.port}
                helperText={errors.port || `Default ${formValues.port}`}
                required
              />
            </>
          )}

          {formValues.type === 'oracle' && (
            <TextField
              margin="dense"
              name="connectString"
              label="Connection String"
              fullWidth
              value={formValues.connectString}
              onChange={handleChange}
              error={!!errors.connectString}
              helperText={errors.connectString || "Format: hostname:port/service_name"}
              required
            />
          )}

          <TextField
            margin="dense"
            name="database"
            label={formValues.type === 'sqlite' ? "Database File Path" : "Database Name"}
            fullWidth
            variant="outlined"
            value={formValues.database}
            onChange={handleChange}
            error={!!errors.database}
            helperText={errors.database || (formValues.type === 'sqlite' ? "Path to the database file" : "")}
            required
          />

          {formValues.type !== 'sqlite' && (
            <>
              <TextField
                margin="dense"
                name="username"
                label="Username"
                fullWidth
                value={formValues.username}
                onChange={handleChange}
                error={!!errors.username}
                helperText={errors.username || "Username for authentication"}
                required={formValues.type !== 'sqlite'}
              />

              <TextField
                margin="dense"
                name="password"
                label="Password"
                type="password"
                fullWidth
                value={formValues.password}
                onChange={handleChange}
                error={!!errors.password}
                helperText={errors.password || "Password for authentication"}
                required={formValues.type !== 'sqlite'}
              />
            </>
          )}

          {formValues.type === 'mssql' && (
            <FormControlLabel
              control={
                <Switch
                  checked={formValues.encrypt}
                  onChange={handleSwitchChange}
                  name="encrypt"
                  color="primary"
                />
              }
              label="Use Encryption"
            />
          )}

          {formValues.type === 'oracle' && (
            <TextField
              margin="dense"
              name="serviceName"
              label="Service Name"
              fullWidth
              value={formValues.serviceName}
              onChange={handleChange}
              error={!!errors.serviceName}
              helperText={errors.serviceName}
              required
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            color="primary" 
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default DatabaseConnectionModal;