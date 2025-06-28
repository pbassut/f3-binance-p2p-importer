import React, { useRef, useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import axios from "axios";

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [fireflyUrl, setFireflyUrl] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [responseJson, setResponseJson] = useState<any>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("fireflyToken");
    const savedUrl = localStorage.getItem("fireflyUrl");
    const savedSecret = localStorage.getItem("fireflySecret");
    if (savedToken) setToken(savedToken);
    if (savedUrl) setFireflyUrl(savedUrl);
    if (savedSecret) setSecret(savedSecret);
  }, []);

  // Persist token, url, and secret to localStorage on change
  useEffect(() => {
    localStorage.setItem("fireflyToken", token);
  }, [token]);
  useEffect(() => {
    localStorage.setItem("fireflyUrl", fireflyUrl);
  }, [fireflyUrl]);
  useEffect(() => {
    localStorage.setItem("fireflySecret", secret);
  }, [secret]);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setSuccess(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", token);
      formData.append("fireflyUrl", fireflyUrl);
      formData.append("secret", secret);
      const res = await axios.post("/api/upload", formData, {
        headers: {
          Accept: "application/json",
        },
      });
      setSuccess("File uploaded and import requested successfully!");
      setResponseJson(res.data);
    } catch (err: any) {
      setError(
        "Failed to upload file: " + (err.response?.data?.message || err.message)
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      bgcolor="#f5f5f5"
    >
      <Paper elevation={3} sx={{ p: 4, maxWidth: 400, width: "100%" }}>
        <Typography variant="h5" align="center" gutterBottom>
          Firefly-III File Importer
        </Typography>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <TextField
            label="Firefly-III API URL"
            type="url"
            value={fireflyUrl}
            onChange={(e) => setFireflyUrl(e.target.value)}
            fullWidth
            required
            disabled={uploading}
            sx={{ mb: 2 }}
            placeholder="https://your-firefly-url"
          />
          <TextField
            label="Firefly-III API Token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            fullWidth
            required
            disabled={uploading}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Firefly Data Importer Secret"
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            fullWidth
            required
            disabled={uploading}
            sx={{ mb: 2 }}
            placeholder="Your Firefly Data Importer Secret"
          />
          <Button
            variant="contained"
            component="label"
            startIcon={<CloudUploadIcon />}
            disabled={uploading || !token || !fireflyUrl || !secret}
            sx={{ width: "100%" }}
          >
            {uploading ? "Uploading..." : "Upload File"}
            <input
              type="file"
              hidden
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.json,.ofx,.qif,.xml"
            />
          </Button>
          {uploading && <LinearProgress sx={{ width: "100%" }} />}
          {success && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {success}
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </Paper>
      {responseJson && (
        <>
          {typeof responseJson.firefly === "string" &&
            responseJson.firefly.includes("\n") && (
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Output logs</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <pre style={{ margin: 0, fontSize: 12 }}>
                    {responseJson.firefly
                      .split("\n")
                      .map((line: string, idx: number) => (
                        <div key={idx}>{line}</div>
                      ))}
                  </pre>
                </AccordionDetails>
              </Accordion>
            )}
        </>
      )}
    </Box>
  );
};

export default App;
