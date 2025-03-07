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
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Typography,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
type DatabaseType = 'mysql' | 'postgres' | 'oracle' | 'mssql' | 'sqlite';

interface DatabaseWizardProps {
  visible: boolean;
  onClose: () => void;
  onSave: (config: any) => Promise<void>;
}

const DatabaseWizard: React.FC<DatabaseWizardProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [formValues, setFormValues] = useState({
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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const databaseTypes = [
    { label: 'MySQL', value: 'mysql' },
    { label: 'PostgreSQL', value: 'postgres' },
    { label: 'Oracle', value: 'oracle' },
    { label: 'Microsoft SQL Server', value: 'mssql' },
    { label: 'SQLite', value: 'sqlite' },
  ];

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
    if (errors[name as string]) {
      setErrors({
        ...errors,
        [name as string]: '',
      });
    }
  };

  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormValues({
      ...formValues,
      [name]: checked,
    });
  };

  const validateConnectionForm = () => {
    const newErrors: Record<string, string> = {};
    let requiredFields: string[] = ['name', 'type'];

    switch (formValues.type) {
      case 'mysql':
      case 'postgres':
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

  const handleNext = async () => {
    if (activeStep === 0) {
      if (!validateConnectionForm()) return;

      setLoading(true);
      try {
        // Test connection and fetch tables
        const response = await fetch('http://localhost:3000/api/databases/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formValues,
            port: parseInt(formValues.port),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to connect to database');
        }

        const data = await response.json();
        setTables(data.tables || []);
        setActiveStep(1);
      } catch (error) {
        setSnackbar({
          open: true,
          message: error instanceof Error ? error.message : 'Failed to connect to database',
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  const handleFinish = async () => {
    if (selectedTables.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select at least one table',
        severity: 'error',
      });
      return;
    }
    console.log("entered the handleFinish function");

    try {
      setLoading(true);
      
      // Fetch schema information for each selected table
      const schemasResponse = await fetch('http://localhost:3000/api/databases/schemas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formValues,
          port: parseInt(formValues.port),
          tables: selectedTables,
        }),
      });

      console.log("this is the schemasResponse:", schemasResponse);
      
      if (!schemasResponse.ok) {
        throw new Error('Failed to fetch table schemas');
      }

      const schemasData = await schemasResponse.json();
      const tableSchemas = schemasData.schemas;

      console.log("[DEBUG] Full schemas data:", schemasData);
      console.log("[DEBUG] Table schemas structure:", tableSchemas);
      console.log("[DEBUG] Selected tables:", selectedTables);
      
      // Save each table with its schema
      for (const table of selectedTables) {
        console.log("[DEBUG] Processing table:", table);
        console.log("[DEBUG] Schema for current table:", tableSchemas[table]);
        
        const saveConfig = {
          ...formValues,
          port: parseInt(formValues.port),
          name: table,
          schema: [{
            tableName: table,
            columns: tableSchemas[table].columns
          }]
        };
        
        console.log("[DEBUG] Save configuration for table:", saveConfig);
        
        try {
          await onSave(saveConfig);
          console.log("[DEBUG] Successfully saved schema for table:", table);
        } catch (error) {
          console.error("[DEBUG] Error saving schema for table:", table, error);
          throw error;
        }
      }

      onClose();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to save database connection',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTableToggle = (table: string) => {
    setSelectedTables(prev =>
      prev.includes(table)
        ? prev.filter(t => t !== table)
        : [...prev, table]
    );
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const steps = ['Database Connection', 'Table Selection'];

  return (
    <Dialog open={visible} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stepper activeStep={activeStep}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </DialogTitle>
      <DialogContent>
        {activeStep === 0 ? (
          // Connection Form
          <>
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

            <FormControl fullWidth margin="dense" error={!!errors.type} required>
              <InputLabel>Database Type</InputLabel>
              <Select
                name="type"
                value={formValues.type}
onChange={(event) => handleChange(event as React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>)}
                label="Database Type"
              >
                {databaseTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
            </FormControl>

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
                  helperText={errors.host}
                  required
                />

                <TextField
                  margin="dense"
                  name="port"
                  label="Port"
                  fullWidth
                  type="number"
                  value={formValues.port}
                  onChange={handleChange}
                  error={!!errors.port}
                  helperText={errors.port}
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
                helperText={errors.connectString}
                required
              />
            )}

            <TextField
              margin="dense"
              name="database"
              label={formValues.type === 'sqlite' ? "Database File Path" : "Database Name"}
              fullWidth
              value={formValues.database}
              onChange={handleChange}
              error={!!errors.database}
              helperText={errors.database}
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
                  helperText={errors.username}
                  required
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
                  helperText={errors.password}
                  required
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
          </>
        ) : (
          // Table Selection
          <>
            <Typography variant="subtitle1" gutterBottom>
              Select tables to include:
            </Typography>
            <List>
              {tables.map((table) => (
                <ListItem
                  key={table}
                  dense
                  divider
                  onClick={() => handleTableToggle(table)}
                >
                  <Checkbox
                    edge="start"
                    checked={selectedTables.includes(table)}
                    tabIndex={-1}
                    disableRipple
                  />
                  <ListItemText primary={table} />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {activeStep > 0 && (
          <Button onClick={handleBack}>Back</Button>
        )}
        {activeStep === 0 ? (
          <Button
            onClick={handleNext}
            variant="contained"
            color="primary"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleFinish}
            variant="contained"
            color="primary"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            Finish
          </Button>
        )}
      </DialogActions>

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
    </Dialog>
  );
};

export default DatabaseWizard;
